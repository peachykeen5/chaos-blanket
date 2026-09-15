import { describe, expect, it } from "vitest";
import { sanitizeLabel } from "../src/validation";

describe("sanitizeLabel", () => {
  it("strips control characters", () => {
    expect(sanitizeLabel("Alpha\nBravo\nCharlie")).toBe("AlphaBravoCharlie");
    expect(sanitizeLabel("A\rB\tC")).toBe("ABC");
  });

  it("still strips the existing bracket/backslash set", () => {
    expect(sanitizeLabel("<script>{}[]\\")).toBe("script");
  });

  it("preserves normal unicode text, including accents", () => {
    expect(sanitizeLabel("Crochet à la Française")).toBe(
      "Crochet à la Française"
    );
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeLabel("  Double Crochet  ")).toBe("Double Crochet");
  });
});
