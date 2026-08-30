import type { Paste } from "@lgjs/types";

import {
  and,
  db,
  eq,
  isNull,
  max,
  schema,
  sql,
} from "@luogu-discussion-archive/db";

import { publicClient } from "./client.js";
import { AccessError, HttpError, UnexpectedStatusError } from "./error.js";
import { expectFiniteNumber, expectRecord, expectString } from "./http.js";
import { saveUserSnapshots } from "./user.js";

const MAX_PASTE_RESPONSE_BYTES = 2 * 1024 * 1024;

function validatePasteResponse(value: unknown) {
  const root = expectRecord(value, "paste.show");
  const code = expectFiniteNumber(root.code, "paste.show.code");
  if (code !== 200) {
    return { code, currentTime: 0, currentData: null };
  }
  const currentData = expectRecord(root.currentData, "paste.show");
  const paste = expectRecord(
    currentData.paste,
    "paste.show",
  ) as unknown as Paste;
  const currentTime = expectFiniteNumber(
    root.currentTime,
    "paste.show.currentTime",
  );
  expectString(paste.id, "paste.show.paste.id", 8);
  if (typeof paste.public !== "boolean")
    throw new Error("Invalid paste visibility");
  return {
    code,
    currentTime,
    currentData: { paste },
  };
}

async function savePaste(paste: Paste, now: Date) {
  await saveUserSnapshots([paste.user], now);

  return db
    .insert(schema.Paste)
    .values({
      id: paste.id,
      time: new Date(paste.time * 1000),
      userId: paste.user.uid,
      public: paste.public,
    })
    .onConflictDoUpdate({
      target: [schema.Paste.id],
      set: {
        time: sql.raw(`excluded."${schema.Paste.time.name}"`),
        userId: sql.raw(`excluded."${schema.Paste.userId.name}"`),
        public: sql.raw(`excluded."${schema.Paste.public.name}"`),
      },
    });
}

async function savePasteSnapshot(paste: Paste, now: Date) {
  await savePaste(paste, now);

  // A private current state revokes public access to every historical body.
  // Keep only visibility/timestamps for operational auditing.
  const safeData = paste.public ? paste.data : null;

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${parseInt(paste.id, 36)})`,
    );

    const lastCaptured = tx
      .select({ val: max(schema.PasteSnapshot.capturedAt) })
      .from(schema.PasteSnapshot)
      .where(eq(schema.PasteSnapshot.pasteId, paste.id));

    const { rowCount } = await tx
      .update(schema.PasteSnapshot)
      .set({ lastSeenAt: now })
      .where(
        and(
          eq(schema.PasteSnapshot.pasteId, paste.id),
          eq(schema.PasteSnapshot.capturedAt, lastCaptured),

          eq(schema.PasteSnapshot.public, paste.public),
          safeData !== null
            ? eq(schema.PasteSnapshot.data, safeData)
            : isNull(schema.PasteSnapshot.data),
        ),
      );

    if (!paste.public) {
      await tx
        .update(schema.PasteSnapshot)
        .set({ data: null })
        .where(eq(schema.PasteSnapshot.pasteId, paste.id));
    }

    if (rowCount === 0) {
      return tx.insert(schema.PasteSnapshot).values({
        pasteId: paste.id,
        public: paste.public,
        data: safeData,
        capturedAt: now,
        lastSeenAt: now,
      });
    }
  });
}

async function restrictPaste(id: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(schema.Paste)
      .set({ public: false })
      .where(eq(schema.Paste.id, id));
    await tx
      .update(schema.PasteSnapshot)
      .set({ data: null })
      .where(eq(schema.PasteSnapshot.pasteId, id));
  });
}

export async function fetchPaste(id: string) {
  let response: Awaited<
    ReturnType<
      typeof publicClient.getJson<ReturnType<typeof validatePasteResponse>>
    >
  >;
  try {
    response = await publicClient.getJson(
      "paste.show",
      { params: { id } },
      {
        endpoint: "paste.show",
        timeoutMs: 20_000,
        maxBytes: MAX_PASTE_RESPONSE_BYTES,
        validate: validatePasteResponse,
      },
    );
  } catch (error) {
    if (
      error instanceof HttpError &&
      (error.status === 403 || error.status === 404)
    ) {
      await restrictPaste(id);
      throw new AccessError(error.url, error.status);
    }
    throw error;
  }
  const { data, url } = response;
  const { code, currentData, currentTime } = data;
  if (code === 403 || code === 404) {
    await restrictPaste(id);
    throw new AccessError(url, code);
  }
  if (code !== 200)
    throw new UnexpectedStatusError("Unexpected status", url, code);
  if (!currentData)
    throw new UnexpectedStatusError("Missing paste data", url, code);

  const now = new Date(currentTime * 1000);
  return savePasteSnapshot(currentData.paste, now);
}
