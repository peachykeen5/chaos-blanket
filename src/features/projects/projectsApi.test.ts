import { describe, expect, it } from "vitest";
import { isValidRowRange } from "./projectsApi";

describe("isValidRowRange", () => {
  it("allows rowMin < rowMax", () => {
    expect(isValidRowRange(2, 6)).toBe(true);
  });

  it("allows rowMin == rowMax (a fixed row count)", () => {
    expect(isValidRowRange(4, 4)).toBe(true);
  });

  it("rejects rowMin > rowMax", () => {
    expect(isValidRowRange(6, 2)).toBe(false);
  });

  it("rejects non-integer or non-positive values", () => {
    expect(isValidRowRange(0, 4)).toBe(false);
    expect(isValidRowRange(1.5, 4)).toBe(false);
  });
});
