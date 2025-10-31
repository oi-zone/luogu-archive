import { fetchDiscuss } from "@luogu-discussion-archive/crawler";
import { client, STREAM_KEY, type Task } from "@luogu-discussion-archive/redis";

export async function perform(task: Task) {
  switch (task.type) {
    case "discuss": {
      const numPages = await fetchDiscuss(
        parseInt(task.id),
        parseInt(task.page ?? "1"),
      );

      if (!task.page)
        for (let i = numPages; i >= 1; i--) {
          await client.xAdd(STREAM_KEY, "*", {
            type: "discuss",
            id: task.id,
            page: String(i),
          } satisfies Task);
        }

      break;
    }
    case "paste":
      // Process paste task
      break;
  }
}
