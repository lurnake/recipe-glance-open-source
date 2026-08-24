import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateRecipeDocument } from "@recipe-glance/schema";
import { layoutRecipe } from "./layout.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(__dirname, "../../../examples");

function loadExample(name: string) {
  const raw = JSON.parse(readFileSync(join(examplesDir, name), "utf8"));
  const result = validateRecipeDocument(raw);
  if (!result.ok) {
    throw new Error(
      `Invalid fixture ${name}: ${result.issues.map((i) => i.message).join("; ")}`,
    );
  }
  return result.document;
}

describe("fixtures validate", () => {
  const files = readdirSync(examplesDir).filter((f) => f.endsWith(".json"));
  it.each(files)("%s is valid rgf/0-draft", (file) => {
    const raw = JSON.parse(readFileSync(join(examplesDir, file), "utf8"));
    const result = validateRecipeDocument(raw);
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });
});

describe("layoutRecipe", () => {
  it("renders wet/dry brownies as a table with setup rows", () => {
    const doc = loadExample("02-wet-dry-merge-brownies.json");
    const layout = layoutRecipe(doc);
    expect(layout.mode).toBe("table");
    if (layout.mode !== "table") return;
    expect(layout.setupRows.length).toBeGreaterThanOrEqual(2);
    expect(layout.rows.length).toBe(9);
    // divided sugar cookies style: each ingredient once
    const bake = layout.actions.find((a) => a.stepId === "s-bake");
    expect(bake).toBeDefined();
    expect(bake!.spans[0]).toMatchObject({ fromRow: 0, toRow: 8 });
  });

  it("shows two rows for divided sugar", () => {
    const doc = loadExample("04-divided-sugar-cookies.json");
    const layout = layoutRecipe(doc);
    expect(layout.mode).toBe("table");
    if (layout.mode !== "table") return;
    const sugarRows = layout.rows.filter((r) => r.ingredientId === "sugar");
    expect(sugarRows.length).toBe(2);
  });

  it("falls back to card for non-interval hostile graph", () => {
    const doc = loadExample("09-noncontiguous-card-fallback.json");
    const layout = layoutRecipe(doc);
    expect(layout.mode).toBe("card");
    if (layout.mode !== "card") return;
    expect(
      layout.warnings.some((w) => w.code === "LAYOUT_TABLE_UNSUPPORTED"),
    ).toBe(true);
  });

  it("expresses setup via after without material edges (whipped cream)", () => {
    const doc = loadExample("10-setup-prereq-whipped-cream.json");
    const chill = doc.steps.find((s) => s.id === "chill");
    const whip = doc.steps.find((s) => s.id === "whip");
    expect(chill?.kind).toBe("setup");
    expect(chill?.uses).toEqual([]);
    expect(whip?.after).toContain("chill");
    const layout = layoutRecipe(doc);
    expect(layout.mode).toBe("table");
    if (layout.mode !== "table") return;
    expect(layout.setupRows.some((s) => s.stepId === "chill")).toBe(true);
  });

  it("multi-output pasta validates and layouts", () => {
    const doc = loadExample("08-multi-output-pasta.json");
    const drain = doc.steps.find((s) => s.id === "drain");
    expect(drain?.outputs?.map((o) => o.id).sort()).toEqual([
      "out-pasta",
      "out-pw",
    ]);
    const layout = layoutRecipe(doc);
    expect(["table", "card"]).toContain(layout.mode);
  });
  it("splits crammed labels into a bare verb plus a detail tier", () => {
    const doc = loadExample("02-wet-dry-merge-brownies.json");
    // An LLM that writes the temp and time into the label should still yield a
    // clean verb, since those render as their own typographic tier.
    const bake = doc.steps.find((s) => s.id === "s-bake")!;
    bake.label = "bake 350\u00b0F (170\u00b0C) 30\u201340 min";

    const layout = layoutRecipe(doc);
    expect(layout.mode).toBe("table");
    if (layout.mode !== "table") return;
    const action = layout.actions.find((a) => a.stepId === "s-bake")!;
    expect(action.verb).toBe("bake");
    expect(action.detail).toBe("350\u00b0F (170\u00b0C) \u00b7 30\u201340 min");
    expect(action.doneness).toBe("a toothpick comes out with moist crumbs");
  });

  it("defaults attention to passive for wait steps only", () => {
    const doc = loadExample("02-wet-dry-merge-brownies.json");
    const layout = layoutRecipe(doc);
    if (layout.mode !== "table") return;
    expect(
      layout.actions.find((a) => a.stepId === "s-bake")?.attention,
    ).toBe("passive");
    expect(
      layout.actions.find((a) => a.stepId === "s-melt")?.attention,
    ).toBe("active");
  });

  it("totals time along the critical path, not by summing branches", () => {
    const doc = loadExample("02-wet-dry-merge-brownies.json");
    const layout = layoutRecipe(doc);
    if (layout.mode !== "table") return;
    // Preheat (15) overlaps the mixing, then bake (40) follows it: 55, not the
    // 61 you get by adding every duration together.
    expect(layout.timing.totalMinutes).toBe(55);
    expect(layout.timing.activeMinutes).toBe(6);
    expect(layout.timing.partial).toBe(false);
  });

  it("collects equipment across steps without duplicates", () => {
    const doc = loadExample("02-wet-dry-merge-brownies.json");
    const layout = layoutRecipe(doc);
    if (layout.mode !== "table") return;
    expect(layout.equipment).toContain("8x8-in pan");
    expect(layout.equipment).toContain("whisk");
    expect(new Set(layout.equipment).size).toBe(layout.equipment.length);
  });
});
