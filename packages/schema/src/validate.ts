import { RecipeDocumentSchema } from "./zod.js";
import type { RecipeDocument } from "./types.js";

export type ValidationIssue = {
  path: string;
  message: string;
};

export type ValidationResult =
  | { ok: true; document: RecipeDocument }
  | { ok: false; issues: ValidationIssue[] };

/**
 * Structural Zod parse + referential / DAG integrity checks.
 */
export function validateRecipeDocument(input: unknown): ValidationResult {
  const parsed = RecipeDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join(".") || "(root)",
        message: i.message,
      })),
    };
  }

  const doc = parsed.data as RecipeDocument;
  const issues = collectGraphIssues(doc);
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, document: doc };
}

function collectGraphIssues(doc: RecipeDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const ingredientIds = new Set(doc.ingredients.map((i) => i.id));
  if (ingredientIds.size !== doc.ingredients.length) {
    issues.push({ path: "ingredients", message: "Duplicate ingredient id" });
  }

  const stepIds = new Set(doc.steps.map((s) => s.id));
  if (stepIds.size !== doc.steps.length) {
    issues.push({ path: "steps", message: "Duplicate step id" });
  }

  const useIds = new Set<string>();
  const outputIds = new Set<string>();
  const outputOwner = new Map<string, string>(); // outputId -> stepId

  for (const step of doc.steps) {
    for (const out of step.outputs ?? []) {
      if (outputIds.has(out.id)) {
        issues.push({
          path: `steps[${step.id}].outputs`,
          message: `Duplicate output id "${out.id}"`,
        });
      }
      outputIds.add(out.id);
      outputOwner.set(out.id, step.id);
    }

    for (const use of step.uses) {
      if (useIds.has(use.id)) {
        issues.push({
          path: `steps[${step.id}].uses`,
          message: `Duplicate material use id "${use.id}"`,
        });
      }
      useIds.add(use.id);

      if (use.source.kind === "ingredient") {
        if (!ingredientIds.has(use.source.ingredientId)) {
          issues.push({
            path: `steps[${step.id}].uses[${use.id}]`,
            message: `Unknown ingredientId "${use.source.ingredientId}"`,
          });
        }
      } else if (!outputIds.has(use.source.outputId) && !willBeDefined(doc, use.source.outputId, step.id)) {
        // Allow forward refs only if output exists somewhere; collect after full pass
      }
    }

    for (const afterId of step.after ?? []) {
      if (!stepIds.has(afterId)) {
        issues.push({
          path: `steps[${step.id}].after`,
          message: `Unknown after step id "${afterId}"`,
        });
      }
    }
  }

  // Resolve output refs after collecting all outputs
  for (const step of doc.steps) {
    for (const use of step.uses) {
      if (use.source.kind === "output" && !outputIds.has(use.source.outputId)) {
        issues.push({
          path: `steps[${step.id}].uses[${use.id}]`,
          message: `Unknown outputId "${use.source.outputId}"`,
        });
      }
    }
  }

  // Cycle detection on combined material + after edges
  const adj = new Map<string, string[]>();
  for (const id of stepIds) adj.set(id, []);

  for (const step of doc.steps) {
    for (const afterId of step.after ?? []) {
      if (stepIds.has(afterId)) {
        adj.get(afterId)!.push(step.id);
      }
    }
    for (const use of step.uses) {
      if (use.source.kind === "output") {
        const owner = outputOwner.get(use.source.outputId);
        if (owner && owner !== step.id) {
          adj.get(owner)!.push(step.id);
        }
      }
    }
  }

  const cycle = findCycle(adj);
  if (cycle) {
    issues.push({
      path: "steps",
      message: `Cycle detected in step graph: ${cycle.join(" → ")}`,
    });
  }

  return issues;
}

function willBeDefined(
  doc: RecipeDocument,
  outputId: string,
  _currentStepId: string,
): boolean {
  return doc.steps.some((s) => s.outputs?.some((o) => o.id === outputId));
}

function findCycle(adj: Map<string, string[]>): string[] | null {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of adj.keys()) color.set(id, WHITE);
  const stack: string[] = [];

  function dfs(u: string): string[] | null {
    color.set(u, GRAY);
    stack.push(u);
    for (const v of adj.get(u) ?? []) {
      if (color.get(v) === GRAY) {
        const idx = stack.indexOf(v);
        return [...stack.slice(idx), v];
      }
      if (color.get(v) === WHITE) {
        const c = dfs(v);
        if (c) return c;
      }
    }
    stack.pop();
    color.set(u, BLACK);
    return null;
  }

  for (const id of adj.keys()) {
    if (color.get(id) === WHITE) {
      const c = dfs(id);
      if (c) return c;
    }
  }
  return null;
}
