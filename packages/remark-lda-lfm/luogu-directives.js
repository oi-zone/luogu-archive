/**
 * @luogu-discussion-archive/remark-lda-ls
 * Copyright (c) 2025 Luogu Discussion Archive Project
 * See AUTHORS.txt in the project root for the full list of contributors.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * Please notice that 「洛谷」 (also known as "Luogu") is a registered trademark of
 * Shanghai Luogu Network Technology Co., Ltd (上海洛谷网络科技有限公司).
 *
 * @license AGPL-3.0-or-later
 */

/// <reference types="mdast-util-directive" />

/**
 * @typedef {import('mdast').Root} Root
 * @typedef {import('mdast').Content} Content
 * @typedef {import('mdast').Paragraph} Paragraph
 * @typedef {import('mdast').Blockquote} Blockquote
 * @typedef {import('mdast').ContainerDirective} ContainerDirective
 * @typedef {import('mdast').PhrasingContent} PhrasingContent
 * @typedef {import('mdast').LsAdmonition} LsAdmonition
 * @typedef {import('mdast').Parent} Parent
 * @typedef {import('unified').Processor<Root>} Processor
 * @typedef {import('vfile').VFile} VFile
 */

const BOX_TYPES = new Set(["info", "success", "warning", "error"]);

const DEFAULT_TITLES = {
  info: "Info",
  success: "Success",
  warning: "Warning",
  error: "Error",
};

/**
 * 是否是 mdast-util-directive 产生的「label 段落」：
 *   node.data.directiveLabel === true
 *
 * @param {Content | null | undefined} node
 * @returns {node is Paragraph}
 */
function isDirectiveLabelParagraph(node) {
  return !!(
    node &&
    node.type === "paragraph" &&
    node.data &&
    node.data.directiveLabel
  );
}

/**
 * 把 ContainerDirective 的 children 拆成：
 * - labelChildren：标题/署名（epigraph）的 phrasing content
 * - contentChildren：真正的内容块（不含 label 段）
 *
 * @param {ContainerDirective} node
 * @returns {{ labelChildren: PhrasingContent[] | null, contentChildren: Content[] }}
 */
function splitLabelAndContent(node) {
  if (node.children && node.children.length > 0) {
    const head = node.children[0];
    if (isDirectiveLabelParagraph(head)) {
      /** @type {PhrasingContent[]} */
      const labelChildren = Array.isArray(head.children)
        ? /** @type {PhrasingContent[]} */ (head.children)
        : [];
      const contentChildren = node.children.slice(1);
      return { labelChildren, contentChildren };
    }
  }
  return { labelChildren: null, contentChildren: node.children || [] };
}

/**
 * :::info / :::success / :::warning / :::error
 * 转成 lsAdmonition + <details><summary>...</summary>...</details>
 *
 * - 标题来自 label（如果有），否则用 DEFAULT_TITLES
 * - {open} 通过 attributes.open 控制默认展开
 *
 * @param {ContainerDirective} node
 * @returns {LsAdmonition}
 */
function toLuoguAdmonition(node) {
  const boxType = /** @type {"info" | "success" | "warning" | "error"} */ (
    node.name
  );
  const attrs = node.attributes || {};
  const isOpen = Object.prototype.hasOwnProperty.call(attrs, "open");

  const { labelChildren, contentChildren } = splitLabelAndContent(node);

  /** @type {PhrasingContent[]} */
  const titleChildren =
    labelChildren && labelChildren.length > 0
      ? labelChildren
      : [{ type: "text", value: DEFAULT_TITLES[boxType] }];

  /** @type {Paragraph} */
  const summaryNode = {
    type: "paragraph",
    data: {
      hName: "summary",
      hProperties: { "data-box-type": boxType },
    },
    children: titleChildren,
  };

  /** @type {LsAdmonition} */
  const detailsNode = {
    type: "lsAdmonition",
    data: {
      hName: "details",
      hProperties: {
        className: [boxType],
        ...(isOpen ? { open: true } : {}),
      },
    },
    children: [summaryNode, ...contentChildren],
  };

  return detailsNode;
}

/**
 * :::align{center} / :::align{right} / :::align{left}
 *
 * - 手册示例是 {center}/{right}，mdast-util-directive 会解析为 attributes.center / attributes.right
 * - 额外支持 align=center 这种写法
 *
 * 渲染成：
 *   <div class="ls-align ls-align-center" data-ls-align="center">...</div>
 *
 * @param {ContainerDirective} node
 * @returns {Content}
 */
function toAlignBlock(node) {
  const attrs = node.attributes || {};

  /** @type {"left" | "center" | "right"} */
  let align = "center";

  if (typeof attrs.align === "string") {
    const v = attrs.align.toLowerCase();
    if (v === "left" || v === "center" || v === "right") {
      align = v;
    }
  } else if (Object.prototype.hasOwnProperty.call(attrs, "right")) {
    align = "right";
  } else if (Object.prototype.hasOwnProperty.call(attrs, "left")) {
    align = "left";
  } else if (Object.prototype.hasOwnProperty.call(attrs, "center")) {
    align = "center";
  }

  /** @type {Content} */
  const alignNode = {
    type: "lsAlign",
    data: {
      hName: "div",
      hProperties: {
        className: ["ls-align", `ls-align-${align}`],
        "data-ls-align": align,
      },
    },
    // 对齐只是包一层，内容原样保留（包括可能存在的 label 段）
    children: node.children || [],
  };

  return alignNode;
}

/**
 * :::epigraph[...] 引言
 *
 * 语义结构：
 *   <figure class="ls-epigraph">
 *     <blockquote>...内容...</blockquote>
 *     <figcaption>...label（如果有）...</figcaption>
 *   </figure>
 *
 * label 由 mdast-util-directive 抽到第一个 data.directiveLabel 段落里，我们把它移到 figcaption。
 *
 * @param {ContainerDirective} node
 * @returns {Content}
 */
function toEpigraphBlock(node) {
  const { labelChildren, contentChildren } = splitLabelAndContent(node);

  /** @type {Blockquote} */
  const quote = {
    type: "blockquote",
    data: {
      hProperties: {
        className: ["ls-epigraph-blockquote"],
      },
    },
    children: contentChildren,
  };

  /** @type {Content[]} */
  const children = [quote];

  if (labelChildren && labelChildren.length > 0) {
    /** @type {Paragraph} */
    const caption = {
      type: "paragraph",
      data: {
        hName: "figcaption",
      },
      children: labelChildren,
    };
    children.push(caption);
  }

  /** @type {Content} */
  const figure = {
    type: "lsEpigraph",
    data: {
      hName: "figure",
      hProperties: {
        className: ["ls-epigraph"],
      },
    },
    children,
  };

  return figure;
}

/**
 * 在 parent.children 上做原地递归转换：
 * - containerDirective(info/success/warning/error) → lsAdmonition
 * - containerDirective(align) → lsAlign
 * - containerDirective(epigraph) → lsEpigraph
 *
 * 并且在替换后，继续对「新节点」做递归，从而正确处理：
 * - 多层嵌套的 :::（洛谷那种 3~N 个冒号的嵌套语法）
 * - 指令内部再套指令
 *
 * @param {Parent} parent
 * @returns {void}
 */
function transformInParent(parent) {
  if (!parent || !Array.isArray(parent.children)) return;

  const children = parent.children;

  for (let index = 0; index < children.length; index += 1) {
    const node = children[index];

    if (!node) continue;

    if (node.type === "containerDirective") {
      const name = node.name || "";

      if (BOX_TYPES.has(name)) {
        const replacement = toLuoguAdmonition(
          /** @type {ContainerDirective} */ (node),
        );
        children[index] = replacement;
        // 新的 details 里可能还有嵌套指令，继续处理
        transformInParent(replacement);
        continue;
      }

      if (name === "align") {
        const replacement = toAlignBlock(
          /** @type {ContainerDirective} */ (node),
        );
        children[index] = replacement;
        transformInParent(/** @type {Parent} */ (replacement));
        continue;
      }

      if (name === "epigraph") {
        const replacement = toEpigraphBlock(
          /** @type {ContainerDirective} */ (node),
        );
        children[index] = replacement;
        transformInParent(/** @type {Parent} */ (replacement));
        continue;
      }

      // 不认识的 directive，保持原样，但递归处理内部（以防里面还有可识别的嵌套指令）
      transformInParent(/** @type {Parent} */ (node));
      continue;
    }

    // 普通父节点，递归 children
    if (
      "children" in node &&
      Array.isArray(/** @type {any} */ (node).children)
    ) {
      transformInParent(/** @type {Parent} */ (/** @type {any} */ (node)));
    }
  }
}

/**
 * 对外导出的主入口：洛谷指令转换。
 *
 * @param {Root} tree
 * @param {Processor} processor
 * @param {VFile} file
 * @returns {void}
 */
export function transformLuoguDirectives(tree, processor, file) {
  transformInParent(/** @type {Parent} */ (tree));
}

/**
 * 兼容旧接口名，方便直接替换原来的 admonitions.js。
 *
 * @param {Root} tree
 * @param {Processor} processor
 * @param {VFile} file
 * @returns {void}
 */
export function transformAdmonitions(tree, processor, file) {
  transformLuoguDirectives(tree, processor, file);
}
