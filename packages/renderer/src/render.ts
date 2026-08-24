import type {
  LayoutResult,
  TableLayout,
  CardLayout,
  DerivedAction,
  Timing,
} from "@recipe-glance/layout";
import type { RecipeDocument } from "@recipe-glance/schema";
import { layoutRecipe } from "@recipe-glance/layout";
import { escapeHtml } from "./escape.js";
import {
  BASE_CSS,
  themeCss,
  DEFAULT_THEME,
  TINT_STEPS,
  type ThemeId,
} from "./themes.js";

/** Optional attribution hook. No hosted-service backlink is injected by default. */

export type RenderOptions = {
  theme?: ThemeId;
  /** Include <style> block (default true for static embeds). */
  includeStyles?: boolean;
  /** Force card layout. */
  forceCard?: boolean;
  /** Root element id. */
  id?: string;
  /** Optional credit text; omitted by default. */
  credit?: string;
  creditUrl?: string;
};

export type RenderResult = {
  html: string;
  layoutMode: "table" | "card";
  warnings: { code: string; message: string }[];
};

/** Layout + render a recipe document to scoped HTML. */
export function renderRecipe(
  doc: RecipeDocument,
  options: RenderOptions = {},
): RenderResult {
  const layout = layoutRecipe(doc, { forceCard: options.forceCard });
  return renderLayout(layout, options);
}

export function renderLayout(
  layout: LayoutResult,
  options: RenderOptions = {},
): RenderResult {
  const theme: ThemeId = options.theme ?? DEFAULT_THEME;
  const includeStyles = options.includeStyles !== false;
  const idAttr = options.id ? ` id="${escapeHtml(options.id)}"` : "";

  const body =
    layout.mode === "table" ? renderTable(layout) : renderCard(layout);

  const styles = includeStyles
    ? `<style>\n${BASE_CSS}\n${themeCss(theme)}\n</style>\n`
    : "";

  const credit = options.credit
    ? `\n${renderCredit(options.credit, options.creditUrl)}`
    : "";

  const html = `${styles}<figure class="rgf rgf--${theme} rgf--${layout.mode}"${idAttr} data-rgf-version="0-draft">
${body}${credit}
</figure>`;

  return {
    html,
    layoutMode: layout.mode,
    warnings: layout.warnings.map((w) => ({
      code: w.code,
      message: w.message,
    })),
  };
}

function renderCredit(text: string, url?: string): string {
  const label = escapeHtml(text);
  return url
    ? `  <p class="rgf__credit"><a href="${escapeHtml(url)}" rel="noopener">${label}</a></p>`
    : `  <p class="rgf__credit">${label}</p>`;
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function formatMinutes(mins: number): string {
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

function renderFacts(opts: {
  servings?: string;
  timing: Timing;
  ingredientCount: number;
  stepCount: number;
}): string {
  const facts: string[] = [];

  if (opts.servings) {
    // "16 squares" → the count gets the figure treatment, the noun does not.
    // A bare "8" is ambiguous on its own, so name the unit.
    const m = /^(\s*[\d¼-¾⅐-⅞][\d¼-¾⅐-⅞/.,–-]*)\s*(.*)$/.exec(opts.servings);
    const [count, noun] = m
      ? [m[1]!.trim(), m[2]!.trim() || "servings"]
      : [opts.servings, ""];
    facts.push(
      `<li class="rgf__fact"><b>${escapeHtml(count)}</b>${
        noun ? ` <span>${escapeHtml(noun)}</span>` : ""
      }</li>`,
    );
  }
  const { totalMinutes, activeMinutes, partial } = opts.timing;
  if (totalMinutes !== undefined) {
    const approx = partial ? "+" : "";
    facts.push(
      `<li class="rgf__fact rgf__fact--hero"><b>${escapeHtml(formatMinutes(totalMinutes))}${approx}</b> <span>total</span></li>`,
    );
  }
  if (activeMinutes !== undefined && activeMinutes < (totalMinutes ?? Infinity)) {
    facts.push(
      `<li class="rgf__fact"><b>${escapeHtml(formatMinutes(activeMinutes))}</b> <span>hands-on</span></li>`,
    );
  }
  if (opts.ingredientCount > 0) {
    facts.push(
      `<li class="rgf__fact"><b>${opts.ingredientCount}</b> <span>ingredients</span></li>`,
    );
  }
  facts.push(
    `<li class="rgf__fact"><b>${opts.stepCount}</b> <span>steps</span></li>`,
  );

  return `<ul class="rgf__facts">${facts.join("")}</ul>`;
}

function renderGear(equipment: string[]): string {
  if (equipment.length === 0) return "";
  const items = equipment
    .map((e) => `<span class="rgf__gear-item">${escapeHtml(e)}</span>`)
    .join("");
  return `<p class="rgf__gear">${items}</p>`;
}

// ---------------------------------------------------------------------------
// Ingredient typography
// ---------------------------------------------------------------------------

const QTY_NUMBER = /^[\d¼-¾⅐-⅞][\d¼-¾⅐-⅞/.,–-]*$/;
const QTY_UNIT =
  /^(?:tsp|teaspoons?|tbsp|tablespoons?|cups?|oz|ounces?|lbs?|pounds?|g|grams?|kg|mg|ml|l|litres?|liters?|qt|quarts?|pt|pints?|gal|gallons?|cloves?|sticks?|cans?|jars?|packets?|packages?|pkgs?|sheets?|slices?|sprigs?|bunch(?:es)?|heads?|shots?|pinch(?:es)?|dash(?:es)?|handfuls?|large|medium|small|whole)$/i;

/** Space-delimited tokens, treating a balanced parenthetical as one token. */
function tokenizeLeading(text: string): { tok: string; end: number }[] {
  const out: { tok: string; end: number }[] = [];
  let i = 0;
  while (i < text.length && out.length < 8) {
    while (i < text.length && text[i] === " ") i++;
    if (i >= text.length) break;
    const start = i;
    if (text[i] === "(") {
      let depth = 0;
      while (i < text.length) {
        if (text[i] === "(") depth++;
        else if (text[i] === ")") {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
        i++;
      }
    } else {
      while (i < text.length && text[i] !== " ") i++;
    }
    out.push({ tok: text.slice(start, i), end: i });
  }
  return out;
}

/**
 * Split "4 oz (115 g) unsalted butter" into quantity and item so the amount
 * can be set in tabular figures. Returns undefined when there is no clear
 * quantity ("salt for pasta water") rather than guessing.
 */
export function splitQuantity(
  text: string,
): { qty: string; item: string } | undefined {
  let cut = 0;
  let sawNumber = false;

  for (const { tok, end } of tokenizeLeading(text)) {
    const bare = tok.replace(/[.,;:]+$/, "");
    if (QTY_NUMBER.test(bare)) {
      sawNumber = true;
      cut = end;
      continue;
    }
    if (!sawNumber) break;
    if (tok.startsWith("(") || QTY_UNIT.test(bare)) {
      cut = end;
      continue;
    }
    break;
  }

  if (!sawNumber || cut === 0) return undefined;
  const qty = text.slice(0, cut).trim();
  const item = text.slice(cut).trim();
  if (item.length === 0) return undefined;
  return { qty, item };
}

function renderIngredientText(text: string): string {
  const split = splitQuantity(text);
  if (!split) return escapeHtml(text);
  return `<span class="rgf__qty">${escapeHtml(split.qty)}</span>${escapeHtml(split.item)}`;
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

function renderOpCell(action: DerivedAction, rowspan: number): string {
  const tier = Math.min(action.depth, TINT_STEPS - 1);
  const passive = action.attention === "passive";
  const classes = [
    "rgf__op",
    `rgf__op--d${tier}`,
    passive ? "rgf__op--passive" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const parts = [`<span class="rgf__verb">${escapeHtml(action.verb)}</span>`];
  if (action.detail) {
    parts.push(`<span class="rgf__detail">${escapeHtml(action.detail)}</span>`);
  }
  if (action.doneness) {
    parts.push(`<span class="rgf__cue">${escapeHtml(action.doneness)}</span>`);
  }
  if (passive) {
    parts.push(`<span class="rgf__tag">hands-off</span>`);
  }

  const span = rowspan > 1 ? ` rowspan="${rowspan}"` : "";
  return `<td class="${classes}"${span}>${parts.join("")}</td>`;
}

/**
 * Pack actions into as few columns as possible: two steps at the same depth
 * that cover disjoint row ranges (melt the butter / mix the dry goods) share a
 * column instead of each claiming one and leaving a strip of empty cells.
 * Actions arrive depth-sorted, and a column never accepts a shallower action
 * than one it already holds, so left-to-right still reads as process order.
 */
function packColumns(
  actions: DerivedAction[],
  rowCount: number,
): DerivedAction[][] {
  const columns: DerivedAction[][] = [];
  const occupied: boolean[][] = [];

  for (const action of actions) {
    const rows = action.spans
      .filter((s) => s.fromRow >= 0 && s.toRow < rowCount)
      .flatMap((s) =>
        Array.from({ length: s.toRow - s.fromRow + 1 }, (_, i) => s.fromRow + i),
      );
    if (rows.length === 0) continue;

    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      if (rows.some((r) => occupied[c]![r])) continue;
      columns[c]!.push(action);
      for (const r of rows) occupied[c]![r] = true;
      placed = true;
      break;
    }
    if (!placed) {
      columns.push([action]);
      const marks = Array.from({ length: rowCount }, () => false);
      for (const r of rows) marks[r] = true;
      occupied.push(marks);
    }
  }

  return columns;
}

function renderTable(layout: TableLayout): string {
  const title = escapeHtml(layout.title);

  // Column model: ingredient | actions ordered by increasing depth, so shallow
  // work sits beside the ingredients and the deepest step (bake) lands right.
  const actions = [...layout.actions].sort((a, b) => a.depth - b.depth);
  const n = layout.rows.length;
  const columns = packColumns(actions, n);
  const colCount = 1 + columns.length;

  type Cell =
    | { type: "skip" }
    | { type: "empty" }
    | { type: "action"; action: DerivedAction; rowspan: number };

  const grid: Cell[][] = Array.from({ length: n }, () =>
    Array.from({ length: columns.length }, () => ({ type: "empty" as const })),
  );

  for (let c = 0; c < columns.length; c++) {
    for (const action of columns[c]!) {
      for (const span of action.spans) {
        if (span.fromRow < 0 || span.toRow >= n) continue;
        grid[span.fromRow]![c] = {
          type: "action",
          action,
          rowspan: span.toRow - span.fromRow + 1,
        };
        for (let r = span.fromRow + 1; r <= span.toRow; r++) {
          grid[r]![c] = { type: "skip" };
        }
      }
    }
  }

  const setupHtml = layout.setupRows
    .map((s) => {
      const detail = s.detail
        ? `<span class="rgf__setup-detail">${escapeHtml(s.detail)}</span>`
        : "";
      const tag =
        s.attention === "passive"
          ? `<span class="rgf__tag">hands-off</span>`
          : "";
      return `<tr class="rgf__setup"><td colspan="${colCount}"><span class="rgf__setup-mark">prep</span>${escapeHtml(s.text)}${detail}${tag}</td></tr>`;
    })
    .join("\n");

  const bodyRows = layout.rows
    .map((row, r) => {
      const alt = r % 2 === 1 ? " rgf__ing--alt" : "";
      const cells: string[] = [
        `<td class="rgf__ing${alt}">${renderIngredientText(row.displayText)}</td>`,
      ];

      // An ingredient claimed only by a setup step (oil for the skillet) has no
      // action anywhere on its row. Drawing a flow track to nothing reads as a
      // missing step, so leave the row's remainder blank.
      const inert =
        columns.length > 0 &&
        grid[r]!.every((cell) => cell.type === "empty");
      if (inert) {
        cells.push(
          `<td class="rgf__flow--none${alt ? " rgf__flow--alt" : ""}" colspan="${columns.length}"></td>`,
        );
        return `<tr>${cells.join("")}</tr>`;
      }

      for (let c = 0; c < columns.length; c++) {
        const cell = grid[r]![c]!;
        if (cell.type === "skip") continue;
        if (cell.type === "empty") {
          cells.push(
            `<td class="rgf__flow${alt ? " rgf__flow--alt" : ""}"></td>`,
          );
        } else {
          cells.push(renderOpCell(cell.action, cell.rowspan));
        }
      }
      return `<tr>${cells.join("")}</tr>`;
    })
    .join("\n");

  // Screen-reader linearization of the graph.
  const srSteps = [
    ...layout.setupRows.map((s) => s.text),
    ...actions.map((a) =>
      [a.instruction, a.detail, a.doneness].filter(Boolean).join(", "),
    ),
  ]
    .map((s) => escapeHtml(s))
    .join("; ");

  return `  <figcaption class="rgf__head">
    <h3 class="rgf__title">${title}</h3>
    ${renderFacts({
      servings: layout.servings,
      timing: layout.timing,
      ingredientCount: layout.rows.length,
      stepCount: layout.setupRows.length + actions.length,
    })}
    ${renderGear(layout.equipment)}
  </figcaption>
  <hr class="rgf__hr"/>
  <p class="rgf__sr-only">Steps: ${srSteps}</p>
  <table class="rgf__table">
    <tbody>
${setupHtml}
${bodyRows}
    </tbody>
  </table>`;
}

// ---------------------------------------------------------------------------
// Card fallback
// ---------------------------------------------------------------------------

function renderCard(layout: CardLayout): string {
  const title = escapeHtml(layout.title);
  const note = `<p class="rgf__fallback-note">${escapeHtml(layout.reason)}</p>`;

  const items = layout.blocks
    .map((b) => {
      const kind = b.kind
        ? `<span class="rgf__card-kind">${escapeHtml(b.kind)}</span>`
        : "";
      const detail = b.detail
        ? `<p class="rgf__card-detail">${escapeHtml(b.detail)}${
            b.doneness ? ` · ${escapeHtml(b.doneness)}` : ""
          }</p>`
        : b.doneness
          ? `<p class="rgf__card-detail">${escapeHtml(b.doneness)}</p>`
          : "";
      const inputs =
        b.inputs.length > 0
          ? `<ul class="rgf__card-inputs">${b.inputs
              .map((i) => `<li>${escapeHtml(i)}</li>`)
              .join("")}</ul>`
          : "";
      const after =
        b.after.length > 0
          ? `<p class="rgf__card-inputs">After: ${escapeHtml(b.after.join(", "))}</p>`
          : "";
      const passive =
        b.attention === "passive" ? " rgf__card-item--passive" : "";
      return `<li class="rgf__card-item${passive}">
  <p class="rgf__card-label">${escapeHtml(b.label)}${kind}</p>
  <p>${escapeHtml(b.instruction)}</p>
  ${detail}
  ${inputs}
  ${after}
</li>`;
    })
    .join("\n");

  return `  <figcaption class="rgf__head">
    <h3 class="rgf__title">${title}</h3>
    ${renderFacts({
      servings: layout.servings,
      timing: layout.timing,
      ingredientCount: 0,
      stepCount: layout.blocks.length,
    })}
    ${renderGear(layout.equipment)}
  </figcaption>
  <hr class="rgf__hr"/>
  ${note}
  <ol class="rgf__card-list">
${items}
  </ol>`;
}

/** Full HTML document wrapper for CLI / preview. */
export function wrapHtmlDocument(fragment: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:2rem;background:#b8b3a7;display:flex;justify-content:center;">
<div style="max-width:52rem;width:100%;">
${fragment}
</div>
</body>
</html>
`;
}
