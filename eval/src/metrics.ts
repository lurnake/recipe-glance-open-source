import type { RecipeDocument } from "@recipe-glance/schema";

export type EvalMetrics = {
  ingredientRecall: number;
  ingredientPrecision: number;
  ingredientF1: number;
  stepCountDelta: number;
  dependencyEdgeRecall: number;
  hasSetupAfter: boolean;
  multiOutputOk: boolean | null;
  dividedUsesOk: boolean | null;
};

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function ingredientTokens(doc: RecipeDocument): Set<string> {
  return new Set(doc.ingredients.map((i) => normalizeText(i.text)));
}

/** Soft match: gold token is recalled if any pred contains it or vice versa. */
function softRecall(gold: Set<string>, pred: Set<string>): number {
  if (gold.size === 0) return 1;
  let hit = 0;
  for (const g of gold) {
    for (const p of pred) {
      if (p.includes(g) || g.includes(p) || tokenOverlap(g, p) >= 0.5) {
        hit++;
        break;
      }
    }
  }
  return hit / gold.size;
}

function softPrecision(gold: Set<string>, pred: Set<string>): number {
  if (pred.size === 0) return gold.size === 0 ? 1 : 0;
  let hit = 0;
  for (const p of pred) {
    for (const g of gold) {
      if (p.includes(g) || g.includes(p) || tokenOverlap(g, p) >= 0.5) {
        hit++;
        break;
      }
    }
  }
  return hit / pred.size;
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(" ").filter((t) => t.length > 2));
  const tb = new Set(b.split(" ").filter((t) => t.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.max(ta.size, tb.size);
}

function materialEdges(doc: RecipeDocument): Set<string> {
  const edges = new Set<string>();
  const outOwner = new Map<string, string>();
  for (const s of doc.steps) {
    for (const o of s.outputs ?? []) outOwner.set(o.id, s.id);
  }
  for (const s of doc.steps) {
    for (const u of s.uses) {
      if (u.source.kind === "ingredient") {
        edges.add(`ing:${u.source.ingredientId}->${s.id}`);
      } else {
        const owner = outOwner.get(u.source.outputId);
        if (owner) edges.add(`step:${owner}->${s.id}`);
      }
    }
    for (const a of s.after ?? []) {
      edges.add(`after:${a}->${s.id}`);
    }
  }
  return edges;
}

export function compareDocuments(
  gold: RecipeDocument,
  pred: RecipeDocument,
): EvalMetrics {
  const gIng = ingredientTokens(gold);
  const pIng = ingredientTokens(pred);
  const recall = softRecall(gIng, pIng);
  const precision = softPrecision(gIng, pIng);
  const f1 =
    recall + precision === 0
      ? 0
      : (2 * recall * precision) / (recall + precision);

  const gEdges = materialEdges(gold);
  const pEdges = materialEdges(pred);
  let edgeHit = 0;
  for (const e of gEdges) {
    // soft: same edge type presence by suffix step patterns is hard; count exact
    if (pEdges.has(e)) edgeHit++;
  }
  // Also score by structural counts when exact IDs differ
  const edgeRecall =
    gEdges.size === 0
      ? 1
      : Math.max(edgeHit / gEdges.size, structuralEdgeScore(gold, pred));

  const goldHasSetup = gold.steps.some((s) => s.kind === "setup");
  const predHasAfter = pred.steps.some((s) => (s.after?.length ?? 0) > 0);
  const hasSetupAfter = !goldHasSetup || predHasAfter || pred.steps.some((s) => s.kind === "setup");

  const goldMulti = gold.steps.find((s) => (s.outputs?.length ?? 0) > 1);
  let multiOutputOk: boolean | null = null;
  if (goldMulti) {
    multiOutputOk = pred.steps.some((s) => (s.outputs?.length ?? 0) > 1);
  }

  const goldDivided = gold.ingredients.some((i) =>
    gold.steps.flatMap((s) => s.uses).filter(
      (u) =>
        u.source.kind === "ingredient" &&
        u.source.ingredientId === i.id,
    ).length > 1,
  );
  let dividedUsesOk: boolean | null = null;
  if (goldDivided) {
    dividedUsesOk = pred.ingredients.some((i) => {
      const uses = pred.steps
        .flatMap((s) => s.uses)
        .filter(
          (u) =>
            u.source.kind === "ingredient" &&
            u.source.ingredientId === i.id,
        );
      return uses.length > 1;
    });
  }

  return {
    ingredientRecall: recall,
    ingredientPrecision: precision,
    ingredientF1: f1,
    stepCountDelta: pred.steps.length - gold.steps.length,
    dependencyEdgeRecall: edgeRecall,
    hasSetupAfter,
    multiOutputOk,
    dividedUsesOk,
  };
}

function structuralEdgeScore(gold: RecipeDocument, pred: RecipeDocument): number {
  const gMat = gold.steps.reduce((n, s) => n + s.uses.length, 0);
  const pMat = pred.steps.reduce((n, s) => n + s.uses.length, 0);
  if (gMat === 0) return 1;
  return Math.min(1, pMat / gMat) * 0.5;
}
