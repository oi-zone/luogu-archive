import assert from "node:assert/strict";
import test from "node:test";

import rehypeStringify from "rehype-stringify";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

import remarkLuoguFlavor from "../index.js";

test("time ranges in plain text remain intact", async () => {
  const input = `- A 组和 B 组模拟比赛当天进行两场（08:00-13:00，13:00-18:00），题目一样，学员可以任选一场参加。\n- B 组授课时间是当天 14:00-17:00。`;
  const file = await unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkLuoguFlavor, { linkOriginalUrl: "https://www.luogu.com.cn/" })
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(input);

  const output = String(file);
  assert.ok(output.includes("08:00-13:00"), "time range should remain intact");
  assert.ok(!output.includes("<div></div>"), "should not insert empty divs");
});
