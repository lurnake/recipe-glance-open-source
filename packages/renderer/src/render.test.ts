import { describe, expect, it } from "vitest";
import { RGF_VERSION } from "@recipe-glance/schema";
import type { RecipeDocument } from "@recipe-glance/schema";
import { renderRecipe } from "./render.js";

const doc: RecipeDocument = {
  version: RGF_VERSION,
  meta: { title: "Tomato toast" },
  ingredients: [
    { id: "bread", text: "2 slices bread" },
    { id: "tomato", text: "1 tomato" },
  ],
  steps: [
    {
      id: "toast",
      instruction: "Toast the bread",
      label: "toast",
      uses: [
        {
          id: "use-bread",
          source: { kind: "ingredient", ingredientId: "bread" },
        },
      ],
      outputs: [{ id: "toast-out", name: "toast" }],
    },
    {
      id: "assemble",
      instruction: "Top toast with tomato",
      label: "top",
      uses: [
        {
          id: "use-toast",
          source: { kind: "output", outputId: "toast-out" },
        },
        {
          id: "use-tomato",
          source: { kind: "ingredient", ingredientId: "tomato" },
        },
      ],
    },
  ],
};

describe("open-source renderer defaults", () => {
  it("uses the basic theme and no hosted credit", () => {
    const result = renderRecipe(doc);
    expect(result.html).toContain("rgf--basic");
    expect(result.html).not.toContain("tabularrecipe.com");
    expect(result.html).not.toContain('<p class="rgf__credit"');
  });

  it("supports an optional caller-provided credit", () => {
    const result = renderRecipe(doc, {
      credit: "Example Kitchen",
      creditUrl: "https://example.com/recipe",
    });
    expect(result.html).toContain("Example Kitchen");
    expect(result.html).toContain("https://example.com/recipe");
  });
});
