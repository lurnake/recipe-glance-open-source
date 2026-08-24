import { describe, expect, it } from "vitest";
import { splitQuantity } from "./render.js";

describe("splitQuantity", () => {
  it("splits a plain amount and unit", () => {
    expect(splitQuantity("8 oz spaghetti")).toEqual({
      qty: "8 oz",
      item: "spaghetti",
    });
  });

  it("keeps a metric parenthetical with the quantity", () => {
    expect(splitQuantity("4 oz (115 g) unsalted butter")).toEqual({
      qty: "4 oz (115 g)",
      item: "unsalted butter",
    });
  });

  it("handles fractions and multi-unit parentheticals", () => {
    expect(splitQuantity("1 shot (4 Tbsp; 60 mL) strong coffee")).toEqual({
      qty: "1 shot (4 Tbsp; 60 mL)",
      item: "strong coffee",
    });
    expect(splitQuantity("1/4 tsp (2.5 mL) vanilla extract")).toEqual({
      qty: "1/4 tsp (2.5 mL)",
      item: "vanilla extract",
    });
  });

  it("treats a bare count as the quantity", () => {
    expect(splitQuantity("2 eggs")).toEqual({ qty: "2", item: "eggs" });
  });

  it("returns undefined rather than guessing when there is no amount", () => {
    expect(splitQuantity("salt for pasta water")).toBeUndefined();
    expect(splitQuantity("zest of 1 lemon")).toBeUndefined();
  });

  it("does not split when nothing would be left as the item", () => {
    expect(splitQuantity("2 cups")).toBeUndefined();
  });
});
