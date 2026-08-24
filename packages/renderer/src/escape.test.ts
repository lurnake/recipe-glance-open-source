import { describe, expect, it } from "vitest";
import { escapeHtml } from "./escape.js";
import { renderRecipe } from "./render.js";
import { RGF_VERSION } from "@recipe-glance/schema";
import type { RecipeDocument } from "@recipe-glance/schema";

describe("escapeHtml", () => {
  it("escapes markup characters", () => {
    expect(escapeHtml(`<script>alert("x")</script>&'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;",
    );
  });
});

describe("renderRecipe XSS", () => {
  it("does not emit raw script from ingredient text", () => {
    const doc: RecipeDocument = {
      version: RGF_VERSION,
      meta: { title: `<img src=x onerror=alert(1)>` },
      ingredients: [
        { id: "a", text: `<script>evil()</script> sugar` },
      ],
      steps: [
        {
          id: "mix",
          instruction: `mix <b>hard</b>`,
          label: `mix`,
          uses: [
            {
              id: "u1",
              source: { kind: "ingredient", ingredientId: "a" },
            },
          ],
        },
      ],
    };
    const { html } = renderRecipe(doc);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x");
  });
});
