/**
 * Luogu table extensions:
 *
 * - 表格合并：单元格仅包含 "^" 或 "<" 时，分别向上/向左合并。
 * - :::cute-table{tuack} / ::cute-table{tuack}：为下一张表格标记「Tuack 风格」。
 */

/**
 * @typedef {import('mdast').Root} Root
 * @typedef {import('mdast').Parent} Parent
 * @typedef {import('mdast').Table} Table
 * @typedef {import('mdast').TableRow} TableRow
 * @typedef {import('mdast').TableCell} TableCell
 * @typedef {import('unified').Processor} Processor
 * @typedef {import('vfile').VFile} VFile
 */

/**
 * 将任意节点转成文本（浅方式）。
 *
 * @param {import('mdast').Content | null | undefined} node
 * @returns {string}
 */
function nodeToString(node) {
  if (!node) return "";
  /** @type {any} */
  const anyNode = node;
  if (typeof anyNode.value === "string") return anyNode.value;
  if (Array.isArray(anyNode.children)) {
    return anyNode.children.map((child) => nodeToString(child)).join("");
  }
  return "";
}

/**
 * @param {import('mdast').Paragraph} node
 * @returns {string}
 */
function getParagraphText(node) {
  if (!node || node.type !== "paragraph") return "";
  return (node.children || []).map((c) => nodeToString(c)).join("");
}

/**
 * 从 cute-table 指令的尾部解析出 style 名称：
 *   ::cute-table{tuack} → "tuack"
 *
 * @param {string} trailer
 * @returns {string | null}
 */
function parseCuteTableStyle(trailer) {
  let rest = trailer.trim();
  if (!rest) return null;
  const start = rest.indexOf("{");
  const end = rest.indexOf("}", start + 1);
  if (start === -1 || end === -1) return null;
  const inside = rest.slice(start + 1, end).trim();
  if (!inside) return null;
  const first = inside.split(/\s+/)[0];
  return first || null;
}

/**
 * 解析 `::cute-table` 指令的 style。
 *
 * 支持：
 * - ::cute-table{tuack}         → 属性对象大概率是 { tuack: "" }
 * - ::cute-table{style=tuack}   → 属性对象 { style: "tuack" }
 * - ::cute-table{.tuack}        → attributes.class 之类（视 mdast-util-directive 解析而定）
 *
 * @param {any} directiveNode
 * @returns {string} style name (默认 "tuack")
 */
function resolveCuteTableStyle(directiveNode) {
  const attrs =
    directiveNode && directiveNode.attributes ? directiveNode.attributes : {};
  let style = "";

  if (typeof attrs.style === "string" && attrs.style.trim()) {
    style = attrs.style.trim();
  }

  // {tuack} → 大概率变成 attrs.tuack = ""，取第一个无值 key
  if (!style) {
    for (const key of Object.keys(attrs)) {
      if (key === "class" || key === "id" || key === "style") continue;
      // key 本身就是 style
      style = key.trim();
      if (style) break;
    }
  }

  // 如果用 .tuack 方式写 class，mdast-util-directive 一般会放到 attrs.class / attrs.className
  if (!style && typeof attrs.class === "string" && attrs.class.trim()) {
    style = attrs.class.trim().split(/\s+/)[0];
  }

  if (!style && typeof attrs.className === "string" && attrs.className.trim()) {
    style = attrs.className.trim().split(/\s+/)[0];
  }

  return style || "tuack";
}

/**
 * 在 props.className 上追加 class。
 *
 * @param {Record<string, any>} props
 * @param {string[]} classNames
 */
function appendClasses(props, classNames) {
  const list = [];

  if (Array.isArray(props.className)) {
    list.push(...props.className);
  } else if (typeof props.className === "string") {
    list.push(
      ...props.className
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }

  for (const cls of classNames) {
    if (cls && !list.includes(cls)) list.push(cls);
  }

  if (list.length > 0) {
    props.className = list;
  }
}

/**
 * 获取 table cell 的「合并类型」：
 *
 * - 单一文本 '^' → "up"
 * - 单一文本 '<' → "left"
 * - 其他 → "normal"
 * - 空 / undefined → "empty"
 *
 * @param {TableCell | null | undefined} cell
 * @returns {"up" | "left" | "normal" | "empty"}
 */
function getCellMergeKind(cell) {
  if (!cell) return "empty";
  const children = cell.children || [];
  if (children.length !== 1) return "normal";
  const child = children[0];
  if (!child || child.type !== "text") return "normal";
  const value = String(child.value || "").trim();
  if (value === "^") return "up";
  if (value === "<") return "left";
  return "normal";
}

/**
 * 对一张 GFM 表格应用 Luogu 的合并语法（^ / <）。
 *
 * @param {Table} table
 */
function applyTableMerges(table) {
  const rows = table.children || [];
  const rowCount = rows.length;
  if (!rowCount) return;

  let colCount = 0;
  for (const row of rows) {
    const len = (row.children || []).length;
    if (len > colCount) colCount = len;
  }
  if (!colCount) return;

  /** @type {("up"|"left"|"normal"|"empty")[][]} */
  const kind = [];
  /** @type {(number|null)[][]} */
  const ownerRow = [];
  /** @type {(number|null)[][]} */
  const ownerCol = [];
  /** @type {number[][]} */
  const rowspan = [];
  /** @type {number[][]} */
  const colspan = [];
  /** @type {boolean[][]} */
  const remove = [];

  let hasMergeMarker = false;

  // 初始化
  for (let r = 0; r < rowCount; r += 1) {
    const row = /** @type {TableRow} */ (rows[r]);
    const cells = row.children || [];

    kind[r] = [];
    ownerRow[r] = [];
    ownerCol[r] = [];
    rowspan[r] = [];
    colspan[r] = [];
    remove[r] = [];

    for (let c = 0; c < colCount; c += 1) {
      const cell = /** @type {TableCell | undefined} */ (cells[c]);
      const k = getCellMergeKind(cell || null);
      kind[r][c] = k;
      remove[r][c] = false;

      if (k === "up" || k === "left") {
        hasMergeMarker = true;
        ownerRow[r][c] = null;
        ownerCol[r][c] = null;
        rowspan[r][c] = 0;
        colspan[r][c] = 0;
      } else if (k === "normal") {
        ownerRow[r][c] = r;
        ownerCol[r][c] = c;
        rowspan[r][c] = 1;
        colspan[r][c] = 1;
      } else {
        // empty
        ownerRow[r][c] = null;
        ownerCol[r][c] = null;
        rowspan[r][c] = 0;
        colspan[r][c] = 0;
      }
    }
  }

  if (!hasMergeMarker) {
    // 这张表没有 ^ / <，直接返回。
    return;
  }

  // 处理合并：先按行从上到下扫描，保证 owner 已经确定。
  for (let r = 0; r < rowCount; r += 1) {
    for (let c = 0; c < colCount; c += 1) {
      const k = kind[r][c];

      if (k === "up") {
        let rr = r - 1;
        /** @type {number | null} */
        let or = null;
        /** @type {number | null} */
        let oc = null;

        while (rr >= 0) {
          if (ownerRow[rr][c] != null && ownerCol[rr][c] != null) {
            or = /** @type {number} */ (ownerRow[rr][c]);
            oc = /** @type {number} */ (ownerCol[rr][c]);
            break;
          }
          rr -= 1;
        }

        if (or != null && oc != null) {
          rowspan[or][oc] = (rowspan[or][oc] || 1) + 1;
          ownerRow[r][c] = or;
          ownerCol[r][c] = oc;
          remove[r][c] = true;
        }
      } else if (k === "left") {
        let cc = c - 1;
        /** @type {number | null} */
        let or = null;
        /** @type {number | null} */
        let oc = null;

        while (cc >= 0) {
          if (ownerRow[r][cc] != null && ownerCol[r][cc] != null) {
            or = /** @type {number} */ (ownerRow[r][cc]);
            oc = /** @type {number} */ (ownerCol[r][cc]);
            break;
          }
          cc -= 1;
        }

        if (or != null && oc != null) {
          colspan[or][oc] = (colspan[or][oc] || 1) + 1;
          ownerRow[r][c] = or;
          ownerCol[r][c] = oc;
          remove[r][c] = true;
        }
      }
    }
  }

  // 写回 AST：删除占位单元格，给 owner cell 写上 rowspan/colspan。
  for (let r = 0; r < rowCount; r += 1) {
    const row = /** @type {TableRow} */ (rows[r]);
    const cells = row.children || [];
    /** @type {TableCell[]} */
    const nextCells = [];

    for (let c = 0; c < colCount; c += 1) {
      const cell = /** @type {TableCell | undefined} */ (cells[c]);
      if (!cell) continue;
      if (remove[r][c]) {
        const newCell = /** @type {TableCell} */ ({
          type: "tableCell",
          data: {
            hProperties: {
              className: ["ls-merged-cell-placeholder"],
            },
          },
          children: [],
        });
        nextCells.push(newCell);
        continue;
      }

      const rs = rowspan[r][c] || 0;
      const cs = colspan[r][c] || 0;

      /** @type {any} */
      const anyCell = cell;
      if (!anyCell.data) anyCell.data = {};
      if (!anyCell.data.hProperties) anyCell.data.hProperties = {};
      const props = anyCell.data.hProperties;

      if (rs > 1) {
        props.rowspan = rs;
      }
      if (cs > 1) {
        props.colspan = cs;
      }

      nextCells.push(cell);
    }

    row.children = nextCells;
  }
}

/**
 * 在整个树上处理：
 * - cutetable directive（::cute-table{...}）
 * - 表格合并
 *
 * @param {Parent} parent
 */
function transformInParent(parent) {
  if (!parent || !Array.isArray(parent.children)) return;

  const children = parent.children;
  let index = 0;

  while (index < children.length) {
    const node = /** @type {any} */ (children[index]);

    // 1. 处理 ::cute-table{...} 这种 leafDirective
    if (node && node.type === "leafDirective" && node.name === "cute-table") {
      const style = resolveCuteTableStyle(node);

      // 在同一 parent 下，向后找到第一张 table
      let tableIndex = -1;
      for (let j = index + 1; j < children.length; j += 1) {
        const cand = /** @type {any} */ (children[j]);
        if (cand && cand.type === "table") {
          tableIndex = j;
          break;
        }
        // 如果遇到块级的非空内容，也可以选择提前 break，这里先保守：只看第一个 table
      }

      if (tableIndex !== -1) {
        const table = /** @type {Table} */ (children[tableIndex]);
        /** @type {any} */
        const anyTable = table;
        if (!anyTable.data) anyTable.data = {};
        if (!anyTable.data.hProperties) anyTable.data.hProperties = {};
        const props = anyTable.data.hProperties;

        appendClasses(
          props,
          ["ls-cute-table", style ? `ls-cute-table-${style}` : null].filter(
            Boolean,
          ),
        );

        if (style) {
          props["data-cute-table-style"] = style;
        }
      }

      // 删除 directive 本身
      children.splice(index, 1);
      // 不要 index++，因为删掉了当前节点，原来 index+1 的节点现在变成 index
      continue;
    }

    // 2. 表格合并
    if (node && node.type === "table") {
      applyTableMerges(/** @type {Table} */ (node));
    }

    // 3. 递归进入子节点
    if (
      node &&
      typeof node === "object" &&
      "children" in node &&
      Array.isArray(node.children)
    ) {
      transformInParent(/** @type {Parent} */ (node));
    }

    index += 1;
  }
}

/**
 * 主入口：处理表格相关的 Luogu 扩展。
 *
 * @param {Root} tree
 * @param {Processor} _processor
 * @param {VFile} _file
 */
export function transformLuoguTables(tree, _processor, _file) {
  transformInParent(/** @type {Parent} */ (tree));
}
