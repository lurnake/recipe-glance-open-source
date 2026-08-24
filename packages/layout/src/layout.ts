import type { RecipeDocument, Step } from "@recipe-glance/schema";
import type {
  CardBlock,
  CardLayout,
  DerivedAction,
  LayoutOptions,
  LayoutResult,
  LayoutWarning,
  SetupRow,
  TableLayout,
  TableRow,
  Timing,
} from "./types.js";

/**
 * Derive a presentation layout from an RGF operation graph.
 * Table spans are computed — never stored as source of truth.
 */
export function layoutRecipe(
  doc: RecipeDocument,
  options: LayoutOptions = {},
): LayoutResult {
  const allowCardFallback = options.allowCardFallback !== false;

  if (options.forceCard) {
    return toCard(doc, "Forced card layout", []);
  }

  const ingredientIndex = new Map(
    doc.ingredients.map((ing, i) => [ing.id, i] as const),
  );
  const stepById = new Map(doc.steps.map((s) => [s.id, s] as const));
  const outputToStep = new Map<string, string>();
  for (const step of doc.steps) {
    for (const out of step.outputs ?? []) {
      outputToStep.set(out.id, step.id);
    }
  }

  const useRows = collectIngredientUses(doc, ingredientIndex);
  if (
    useRows.length === 0 &&
    doc.steps.every((s) => (s.kind ?? "transform") === "setup")
  ) {
    return toCard(doc, "No ingredient uses to tabulate", [
      {
        code: "LAYOUT_EMPTY",
        message: "Recipe has no ingredient material uses",
      },
    ]);
  }

  // stepId → set of MaterialUse ids (ingredient leaves only)
  const stepLeafUses = new Map<string, Set<string>>();
  for (const step of doc.steps) {
    if ((step.kind ?? "transform") === "setup") continue;
    stepLeafUses.set(
      step.id,
      transitiveIngredientUses(step, outputToStep, stepById),
    );
  }

  const orderedRows = orderRowsForContiguity(useRows, stepLeafUses);
  const useIdToRow = new Map(orderedRows.map((r, i) => [r.useId, i] as const));

  const warnings: LayoutWarning[] = [];
  const contiguousOk = new Map<string, boolean>();
  const spansByStep = new Map<string, { fromRow: number; toRow: number }[]>();

  for (const [stepId, leafUses] of stepLeafUses) {
    const idxs = [...leafUses]
      .map((id) => useIdToRow.get(id))
      .filter((n): n is number => n !== undefined)
      .sort((a, b) => a - b);

    if (idxs.length === 0) {
      contiguousOk.set(stepId, true);
      spansByStep.set(stepId, []);
      continue;
    }

    const unique = [...new Set(idxs)];
    const contiguous = isContiguous(unique);
    contiguousOk.set(stepId, contiguous);
    if (contiguous) {
      spansByStep.set(stepId, [
        { fromRow: unique[0]!, toRow: unique[unique.length - 1]! },
      ]);
    } else {
      spansByStep.set(stepId, []);
      warnings.push({
        code: "LAYOUT_NON_CONTIGUOUS",
        message: `Step "${stepId}" material uses are non-contiguous after row ordering`,
        stepIds: [stepId],
      });
    }
  }

  const failed = [...contiguousOk.entries()].filter(([, ok]) => !ok);
  if (failed.length > 0 && allowCardFallback) {
    warnings.push({
      code: "LAYOUT_TABLE_UNSUPPORTED",
      message:
        "Falling back to card layout because one or more steps cannot form contiguous table spans",
      stepIds: failed.map(([id]) => id),
    });
    return toCard(
      doc,
      "One or more steps have non-contiguous ingredient-use spans",
      warnings,
    );
  }

  const depthByStep = computeDepths(doc, outputToStep);
  const actions: DerivedAction[] = [];
  for (const step of doc.steps) {
    if ((step.kind ?? "transform") === "setup") continue;
    const spans = spansByStep.get(step.id) ?? [];
    const leaves = stepLeafUses.get(step.id);
    if (spans.length === 0 && (leaves?.size ?? 0) === 0) continue;
    // If we did not fallback, empty spans with leaves means allowCardFallback was false
    actions.push({
      stepId: step.id,
      label: step.label ?? step.instruction,
      instruction: step.instruction,
      kind: step.kind,
      verb: deriveVerb(step),
      detail: deriveDetail(step),
      doneness: step.doneness,
      attention: attentionOf(step),
      spans,
      depth: depthByStep.get(step.id) ?? 0,
    });
  }

  const setupRows: SetupRow[] = doc.steps
    .filter((s) => s.kind === "setup")
    .map((s) => ({
      stepId: s.id,
      text: deriveVerb(s),
      detail: deriveDetail(s),
      attention: attentionOf(s),
    }));

  const maxDepth =
    actions.length === 0 ? 0 : Math.max(...actions.map((a) => a.depth));

  return {
    mode: "table",
    title: doc.meta.title,
    servings: doc.meta.servings,
    setupRows,
    rows: orderedRows,
    actions,
    equipment: collectEquipment(doc),
    timing: computeTiming(doc, outputToStep),
    maxDepth,
    warnings,
  } satisfies TableLayout;
}

function attentionOf(step: Step): "active" | "passive" {
  if (step.attention) return step.attention;
  return step.kind === "wait" ? "passive" : "active";
}

/**
 * Cell headline. LLMs often cram temp/time into `label` ("bake 350°F 30 min");
 * those render as their own tier, so strip them back out when present.
 */
function deriveVerb(step: Step): string {
  let verb = step.label ?? step.instruction;
  for (const raw of [step.temperature?.raw, step.duration?.raw]) {
    if (!raw) continue;
    const i = verb.toLowerCase().indexOf(raw.toLowerCase());
    if (i >= 0) verb = verb.slice(0, i) + verb.slice(i + raw.length);
  }
  // Leftover connective debris from the removal ("bake at  for ").
  verb = verb
    .replace(/\s+/g, " ")
    .replace(/\s*[,;·]\s*$/, "")
    .replace(/\s+(?:at|for|to|until)\s*$/i, "")
    .trim();
  return verb.length > 0 ? verb : (step.label ?? step.instruction);
}

function deriveDetail(step: Step): string | undefined {
  const parts = [step.temperature?.raw, step.duration?.raw].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  );
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function collectEquipment(doc: RecipeDocument): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const step of doc.steps) {
    for (const item of step.equipment ?? []) {
      const key = item.trim().toLowerCase();
      if (key.length === 0 || seen.has(key)) continue;
      seen.add(key);
      out.push(item.trim());
    }
  }
  return out;
}

function stepMinutes(step: Step): number | undefined {
  const d = step.duration;
  if (!d) return undefined;
  return d.maxMinutes ?? d.minMinutes;
}

/**
 * Total = longest path through the dependency graph, so parallel branches
 * (dough rising while the sauce simmers) overlap instead of summing.
 * Active = plain sum, since hands-on work cannot overlap.
 */
function computeTiming(
  doc: RecipeDocument,
  outputToStep: Map<string, string>,
): Timing {
  const stepById = new Map(doc.steps.map((s) => [s.id, s] as const));
  const memo = new Map<string, number>();
  let sawDuration = false;
  let partial = false;
  let active = 0;

  for (const step of doc.steps) {
    const mins = stepMinutes(step);
    if (mins === undefined) {
      if (step.kind !== "setup") partial = true;
      continue;
    }
    sawDuration = true;
    if (attentionOf(step) === "active") active += mins;
  }

  function pathTo(stepId: string, stack: Set<string>): number {
    const cached = memo.get(stepId);
    if (cached !== undefined) return cached;
    if (stack.has(stepId)) return 0;
    stack.add(stepId);
    const step = stepById.get(stepId);
    if (!step) {
      stack.delete(stepId);
      return 0;
    }

    let longestPredecessor = 0;
    const predecessors = new Set<string>(step.after ?? []);
    for (const use of step.uses) {
      if (use.source.kind !== "output") continue;
      const owner = outputToStep.get(use.source.outputId);
      if (owner) predecessors.add(owner);
    }
    for (const pred of predecessors) {
      longestPredecessor = Math.max(longestPredecessor, pathTo(pred, stack));
    }

    const total = longestPredecessor + (stepMinutes(step) ?? 0);
    memo.set(stepId, total);
    stack.delete(stepId);
    return total;
  }

  let critical = 0;
  for (const step of doc.steps) {
    critical = Math.max(critical, pathTo(step.id, new Set()));
  }

  if (!sawDuration) return { partial: true };
  return {
    totalMinutes: critical > 0 ? critical : undefined,
    activeMinutes: active > 0 ? active : undefined,
    partial,
  };
}

type UseRowSeed = TableRow & { appearance: number; narrativeRank: number };

function collectIngredientUses(
  doc: RecipeDocument,
  ingredientIndex: Map<string, number>,
): UseRowSeed[] {
  const ingById = new Map(doc.ingredients.map((i) => [i.id, i] as const));
  const rows: UseRowSeed[] = [];
  const seen = new Set<string>();
  let appearance = 0;

  for (const step of doc.steps) {
    for (const use of step.uses) {
      if (use.source.kind !== "ingredient") continue;
      if (seen.has(use.id)) continue;
      seen.add(use.id);
      const ing = ingById.get(use.source.ingredientId);
      if (!ing) continue;
      const displayText = use.portion
        ? `${ing.text} (${use.portion})`
        : ing.text;
      rows.push({
        useId: use.id,
        ingredientId: ing.id,
        displayText,
        portion: use.portion,
        appearance: appearance++,
        narrativeRank: ingredientIndex.get(ing.id) ?? 0,
      });
    }
  }
  return rows;
}

function transitiveIngredientUses(
  step: Step,
  outputToStep: Map<string, string>,
  stepById: Map<string, Step>,
  memo = new Map<string, Set<string>>(),
): Set<string> {
  if (memo.has(step.id)) return memo.get(step.id)!;
  memo.set(step.id, new Set());
  const result = new Set<string>();

  for (const use of step.uses) {
    if (use.source.kind === "ingredient") {
      result.add(use.id);
    } else {
      const ownerId = outputToStep.get(use.source.outputId);
      if (!ownerId) continue;
      const owner = stepById.get(ownerId);
      if (!owner) continue;
      for (const leaf of transitiveIngredientUses(
        owner,
        outputToStep,
        stepById,
        memo,
      )) {
        result.add(leaf);
      }
    }
  }

  memo.set(step.id, result);
  return result;
}

function isContiguous(sortedUnique: number[]): boolean {
  if (sortedUnique.length <= 1) return true;
  for (let i = 1; i < sortedUnique.length; i++) {
    if (sortedUnique[i]! !== sortedUnique[i - 1]! + 1) return false;
  }
  return true;
}

function countNonContiguous(
  order: string[],
  stepLeafUses: Map<string, Set<string>>,
): number {
  const index = new Map(order.map((id, i) => [id, i] as const));
  let bad = 0;
  for (const leaves of stepLeafUses.values()) {
    if (leaves.size === 0) continue;
    const idxs = [...leaves]
      .map((id) => index.get(id))
      .filter((n): n is number => n !== undefined)
      .sort((a, b) => a - b);
    const unique = [...new Set(idxs)];
    if (!isContiguous(unique)) bad++;
  }
  return bad;
}

/**
 * Try a few deterministic orderings; pick the one with fewest non-contiguous steps.
 * Tie-break: prefer first-appearance order (stable, narrative-ish).
 */
function orderRowsForContiguity(
  rows: UseRowSeed[],
  stepLeafUses: Map<string, Set<string>>,
): TableRow[] {
  if (rows.length === 0) return [];

  const byAppearance = [...rows].sort((a, b) => a.appearance - b.appearance);
  const byNarrative = [...rows].sort((a, b) => {
    const d = a.narrativeRank - b.narrativeRank;
    return d !== 0 ? d : a.appearance - b.appearance;
  });

  // Cluster: for each use, find the smallest leaf-set step that contains it; group by that
  const clusterKey = new Map<string, string>();
  for (const row of rows) {
    let best: { id: string; size: number } | null = null;
    for (const [stepId, leaves] of stepLeafUses) {
      if (!leaves.has(row.useId)) continue;
      if (!best || leaves.size < best.size) {
        best = { id: stepId, size: leaves.size };
      }
    }
    clusterKey.set(row.useId, best?.id ?? "_");
  }
  const byCluster = [...rows].sort((a, b) => {
    const ca = clusterKey.get(a.useId) ?? "_";
    const cb = clusterKey.get(b.useId) ?? "_";
    if (ca !== cb) return ca.localeCompare(cb);
    return a.appearance - b.appearance;
  });

  const candidates = [byAppearance, byNarrative, byCluster];
  let best = byAppearance;
  let bestScore = countNonContiguous(
    best.map((r) => r.useId),
    stepLeafUses,
  );

  for (const cand of candidates) {
    const score = countNonContiguous(
      cand.map((r) => r.useId),
      stepLeafUses,
    );
    if (score < bestScore) {
      best = cand;
      bestScore = score;
    }
  }

  return best.map(({ useId, ingredientId, displayText, portion }) => ({
    useId,
    ingredientId,
    displayText,
    portion,
  }));
}

function computeDepths(
  doc: RecipeDocument,
  outputToStep: Map<string, string>,
): Map<string, number> {
  const memo = new Map<string, number>();
  const stepById = new Map(doc.steps.map((s) => [s.id, s] as const));

  function depth(stepId: string, stack: Set<string>): number {
    if (memo.has(stepId)) return memo.get(stepId)!;
    if (stack.has(stepId)) return 0;
    stack.add(stepId);
    const step = stepById.get(stepId);
    if (!step) {
      stack.delete(stepId);
      return 0;
    }
    let maxParent = -1;
    for (const use of step.uses) {
      if (use.source.kind === "output") {
        const owner = outputToStep.get(use.source.outputId);
        if (owner) {
          maxParent = Math.max(maxParent, depth(owner, stack));
        }
      }
    }
    const d = maxParent + 1;
    memo.set(stepId, d);
    stack.delete(stepId);
    return d;
  }

  for (const step of doc.steps) {
    if ((step.kind ?? "transform") !== "setup") {
      depth(step.id, new Set());
    }
  }
  return memo;
}

function toCard(
  doc: RecipeDocument,
  reason: string,
  warnings: LayoutWarning[],
): CardLayout {
  const ingById = new Map(doc.ingredients.map((i) => [i.id, i] as const));
  const outNames = new Map<string, string>();
  for (const step of doc.steps) {
    for (const o of step.outputs ?? []) {
      outNames.set(o.id, o.name ?? o.id);
    }
  }

  const blocks: CardBlock[] = doc.steps.map((step) => {
    const inputs = step.uses.map((u) => {
      if (u.source.kind === "ingredient") {
        const text =
          ingById.get(u.source.ingredientId)?.text ?? u.source.ingredientId;
        return u.portion ? `${text} (${u.portion})` : text;
      }
      return outNames.get(u.source.outputId) ?? u.source.outputId;
    });
    return {
      stepId: step.id,
      label: deriveVerb(step),
      instruction: step.instruction,
      kind: step.kind,
      detail: deriveDetail(step),
      doneness: step.doneness,
      attention: attentionOf(step),
      inputs,
      outputs: (step.outputs ?? []).map((o) => o.name ?? o.id),
      after: step.after ?? [],
    };
  });

  const outputToStep = new Map<string, string>();
  for (const step of doc.steps) {
    for (const out of step.outputs ?? []) outputToStep.set(out.id, step.id);
  }

  return {
    mode: "card",
    title: doc.meta.title,
    servings: doc.meta.servings,
    reason,
    blocks,
    equipment: collectEquipment(doc),
    timing: computeTiming(doc, outputToStep),
    warnings,
  };
}
