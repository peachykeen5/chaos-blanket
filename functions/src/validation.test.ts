import { describe, expect, it } from "vitest";
import { isDenylisted, isValidLabel, sanitizeLabel } from "./validation";

describe("sanitizeLabel", () => {
  it("strips angle brackets and braces and trims", () => {
    expect(sanitizeLabel("  <b>Red</b>  ")).toBe("bRed/b");
  });
});

describe("isValidLabel", () => {
  it("accepts 1-60 characters", () => {
    expect(isValidLabel("Red")).toBe(true);
    expect(isValidLabel("x".repeat(60))).toBe(true);
  });

  it("rejects empty or over-length labels", () => {
    expect(isValidLabel("")).toBe(false);
    expect(isValidLabel("x".repeat(61))).toBe(false);
  });
});

describe("isDenylisted", () => {
  it("flags a label containing a denylisted term, case-insensitively", () => {
    expect(isDenylisted("Visit HTTP://spam.example now")).toBe(true);
  });

  it("allows an ordinary label", () => {
    expect(isDenylisted("Double Crochet")).toBe(false);
  });
});
