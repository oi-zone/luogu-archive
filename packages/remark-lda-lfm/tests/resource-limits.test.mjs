import assert from "node:assert/strict";
import test from "node:test";

import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

import remarkLuoguFlavor from "../index.js";
import { transformLuoguDirectives } from "../luogu-directives.js";
import { MARKDOWN_SECURITY_LIMITS } from "../security-limits.js";

async function render(input) {
  return String(
    await unified()
      .use(remarkParse)
      .use(remarkLuoguFlavor)
      .use(remarkRehype)
      .use(rehypeStringify)
      .process(input),
  );
}

test("oversized code blocks render only a bounded safe preview", async () => {
  const input = `\`\`\`cpp lines=1-1000000000\n${"x".repeat(
    MARKDOWN_SECURITY_LIMITS.maxCodeBlockBytes + 1,
  )}\n\`\`\``;
  const output = await render(input);
  assert.match(output, /代码块过大/);
  assert.ok(output.length < MARKDOWN_SECURITY_LIMITS.maxCodeBlockBytes / 2);
  assert.equal(output.includes("data-ls-highlight-lines"), false);
});

test("deep directives stop at the configured nesting boundary", () => {
  let node = { type: "paragraph", children: [{ type: "text", value: "end" }] };
  for (let index = 0; index < 100; index += 1) {
    node = { type: "containerDirective", name: "info", children: [node] };
  }
  const tree = { type: "root", children: [node] };
  transformLuoguDirectives(tree, {}, {});
  assert.match(JSON.stringify(tree), /指令嵌套过深/);
});

test("oversized tables are replaced before merge processing", async () => {
  const rows = Array.from(
    { length: MARKDOWN_SECURITY_LIMITS.maxTableRows + 1 },
    (_, index) => `| ${String(index)} | value |`,
  );
  const output = await render(["| a | b |", "| - | - |", ...rows].join("\n"));
  assert.match(output, /表格过大/);
});

test("magic-link decoration is capped", async () => {
  const input = Array.from(
    { length: MARKDOWN_SECURITY_LIMITS.maxMagicLinks + 20 },
    (_, index) =>
      `[u${String(index)}](https://www.luogu.com.cn/user/${String(index + 1)})`,
  ).join("\n\n");
  const output = await render(input);
  assert.equal(
    (output.match(/data-ls-user=/g) ?? []).length,
    MARKDOWN_SECURITY_LIMITS.maxMagicLinks,
  );
});
