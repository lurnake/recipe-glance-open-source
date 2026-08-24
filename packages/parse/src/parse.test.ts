import { describe, expect, it } from "vitest";
import { extractJsonObject } from "./extract-json.js";
import { parseRecipe } from "./parse.js";
import { createMockProvider } from "./providers.js";
import { validateRecipeDocument } from "@recipe-glance/schema";

describe("extractJsonObject", () => {
  it("parses fenced json", () => {
    const v = extractJsonObject('Here:\n```json\n{"a":1}\n```');
    expect(v).toEqual({ a: 1 });
  });
});

describe("parseRecipe mock", () => {
  it("returns validated document", async () => {
    const result = await parseRecipe(
      {
        text: `Tomato Toast\n\nIngredients:\n- 1 slice bread\n- 1 tomato\n\nToast bread. Top with tomato.`,
      },
      { provider: createMockProvider() },
    );
    expect(result.provider).toBe("mock");
    const v = validateRecipeDocument(result.document);
    expect(v.ok).toBe(true);
    expect(result.document.ingredients.length).toBeGreaterThan(0);
  });
});
