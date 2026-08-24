import { describe, expect, it } from "vitest";
import { compareDocuments } from "./metrics.js";
import { RGF_VERSION, type RecipeDocument } from "@recipe-glance/schema";

const base: RecipeDocument = {
  version: RGF_VERSION,
  meta: { title: "T" },
  ingredients: [
    { id: "a", text: "1 cup flour" },
    { id: "b", text: "2 eggs" },
  ],
  steps: [
    {
      id: "mix",
      instruction: "mix",
      uses: [
        { id: "u1", source: { kind: "ingredient", ingredientId: "a" } },
        { id: "u2", source: { kind: "ingredient", ingredientId: "b" } },
      ],
    },
  ],
};

describe("compareDocuments", () => {
  it("scores perfect match highly", () => {
    const m = compareDocuments(base, structuredClone(base));
    expect(m.ingredientF1).toBeGreaterThan(0.9);
  });
});
