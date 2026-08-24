#!/usr/bin/env node
/**
 * Eval harness: for each gold fixture, optionally re-parse from a text export
 * or score mock/heuristic. Default: layout+schema self-check + structural metrics
 * against gold by re-serializing a "prose" approximation and mock-parsing.
 *
 * With GEMINI_API_KEY / XAI_API_KEY: full LLM parse from prose reconstruction.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateRecipeDocument, type RecipeDocument } from "@recipe-glance/schema";
import { parseRecipe, createMockProvider, createProvider } from "@recipe-glance/parse";
import { compareDocuments } from "./metrics.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../..");
const examplesDir = join(root, "examples");

function goldToProse(doc: RecipeDocument): string {
  const lines = [doc.meta.title, ""];
  if (doc.meta.servings) lines.push(`Serves: ${doc.meta.servings}`, "");
  lines.push("Ingredients:");
  for (const ing of doc.ingredients) {
    lines.push(`- ${ing.text}`);
  }
  lines.push("", "Steps:");
  for (const step of doc.steps) {
    lines.push(`- ${step.instruction}`);
  }
  return lines.join("\n");
}

async function main() {
  const useReal = process.argv.includes("--llm");
  const provider = useReal ? createProvider() : createMockProvider();
  const files = readdirSync(examplesDir)
    .filter((f) => f.endsWith(".json") && !f.includes("noncontiguous"))
    .sort();

  const rows: Record<string, unknown>[] = [];
  for (const file of files) {
    const goldRaw = JSON.parse(readFileSync(join(examplesDir, file), "utf8"));
    const goldVal = validateRecipeDocument(goldRaw);
    if (!goldVal.ok) {
      console.error(`Skip invalid gold ${file}`);
      continue;
    }
    const gold = goldVal.document;
    const prose = goldToProse(gold);
    try {
      const parsed = await parseRecipe({ text: prose }, { provider });
      const metrics = compareDocuments(gold, parsed.document);
      rows.push({
        file,
        title: gold.meta.title,
        provider: parsed.provider,
        repairs: parsed.repairs,
        ...metrics,
      });
      console.log(
        `${file}: F1=${metrics.ingredientF1.toFixed(2)} edgeR=${metrics.dependencyEdgeRecall.toFixed(2)} stepsΔ=${metrics.stepCountDelta}`,
      );
    } catch (e) {
      rows.push({ file, error: (e as Error).message });
      console.error(`${file}: ERROR ${(e as Error).message}`);
    }
  }

  const outDir = join(root, "eval", "reports");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `eval-${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify({ useReal, rows }, null, 2));
  console.log(`Wrote ${outPath}`);

  const f1s = rows
    .map((r) => r.ingredientF1 as number)
    .filter((n) => typeof n === "number");
  if (f1s.length) {
    const avg = f1s.reduce((a, b) => a + b, 0) / f1s.length;
    console.log(`Mean ingredient F1: ${avg.toFixed(3)} (n=${f1s.length})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
