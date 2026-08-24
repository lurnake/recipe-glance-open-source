import { describe, expect, it } from "vitest";
import { validateRecipeDocument } from "./validate.js";
import { RGF_VERSION } from "./types.js";

const linear = {
  version: RGF_VERSION,
  meta: { title: "Vinaigrette" },
  ingredients: [
    { id: "oil", text: "3 Tbsp olive oil" },
    { id: "vin", text: "1 Tbsp red wine vinegar" },
  ],
  steps: [
    {
      id: "whisk",
      kind: "transform",
      instruction: "Whisk oil and vinegar",
      label: "whisk",
      uses: [
        { id: "u-oil", source: { kind: "ingredient", ingredientId: "oil" } },
        { id: "u-vin", source: { kind: "ingredient", ingredientId: "vin" } },
      ],
      outputs: [{ id: "out-dressing", name: "vinaigrette" }],
    },
  ],
};

describe("validateRecipeDocument", () => {
  it("accepts a simple linear recipe", () => {
    const r = validateRecipeDocument(linear);
    expect(r.ok).toBe(true);
  });

  it("rejects unknown ingredient refs", () => {
    const bad = structuredClone(linear);
    bad.steps[0].uses[0].source = {
      kind: "ingredient",
      ingredientId: "nope",
    };
    const r = validateRecipeDocument(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.message.includes("Unknown ingredientId"))).toBe(
        true,
      );
    }
  });

  it("rejects cycles", () => {
    const cyclic = {
      version: RGF_VERSION,
      meta: { title: "Cycle" },
      ingredients: [{ id: "a", text: "a" }],
      steps: [
        {
          id: "s1",
          instruction: "one",
          uses: [
            { id: "u1", source: { kind: "ingredient", ingredientId: "a" } },
          ],
          outputs: [{ id: "o1" }],
          after: ["s2"],
        },
        {
          id: "s2",
          instruction: "two",
          uses: [{ id: "u2", source: { kind: "output", outputId: "o1" } }],
          outputs: [{ id: "o2" }],
        },
      ],
    };
    const r = validateRecipeDocument(cyclic);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.message.includes("Cycle"))).toBe(true);
    }
  });

  it("rejects wrong version", () => {
    const r = validateRecipeDocument({ ...linear, version: "rgf/1" });
    expect(r.ok).toBe(false);
  });
});
