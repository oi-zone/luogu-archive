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

import { client } from "./client.js";
import { AccessError, HttpError, UnexpectedStatusError } from "./error.js";
import { saveUserSnapshots } from "./user.js";

async function savePaste(paste: Paste, now: Date) {
  await saveUserSnapshots([paste.user], now);

  return db
    .insert(schema.Paste)
    .values({
      id: paste.id,
      time: new Date(paste.time * 1000),
      userId: paste.user.uid,
    })
    .onConflictDoUpdate({
      target: [schema.Paste.id],
      set: {
        time: sql.raw(`excluded."${schema.Paste.time.name}"`),
        userId: sql.raw(`excluded."${schema.Paste.userId.name}"`),
      },
    });
}

async function savePasteSnapshot(paste: Paste, now: Date) {
  await savePaste(paste, now);

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
          paste.data !== null // eslint-disable-line @typescript-eslint/no-unnecessary-condition
            ? eq(schema.PasteSnapshot.data, paste.data)
            : isNull(schema.PasteSnapshot.data),
        ),
      );

    if (rowCount === 0)
      return tx.insert(schema.PasteSnapshot).values({
        pasteId: paste.id,
        public: paste.public,
        data: paste.data,
        capturedAt: now,
        lastSeenAt: now,
      });
  });
}

export async function fetchPaste(id: string) {
  const res = await client.get("paste.show", { params: { id } });
  const { code, currentData, currentTime } = await res
    .json()
    .catch((err: unknown) => {
      throw res.ok ? err : new HttpError(res);
    });
  if (code === 403 || code === 404) throw new AccessError(res.url, code);
  if (code !== 200)
    throw new UnexpectedStatusError("Unexpected status", res.url, code);

  const now = new Date(currentTime * 1000);
  return savePasteSnapshot(currentData.paste, now);
}
