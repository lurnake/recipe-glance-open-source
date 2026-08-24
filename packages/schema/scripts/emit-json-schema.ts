import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { RecipeDocumentSchema } from "../src/zod.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "json-schema");
mkdirSync(outDir, { recursive: true });

const jsonSchema = zodToJsonSchema(RecipeDocumentSchema, {
  name: "RecipeDocument",
  $refStrategy: "none",
});

const outPath = join(outDir, "rgf-0-draft.json");
writeFileSync(outPath, JSON.stringify(jsonSchema, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
