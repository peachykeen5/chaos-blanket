import { describe, expect, it } from "vitest";
import { normalizeHex, sanitizeLabel } from "../src/validation";

describe("normalizeHex", () => {
  it("normalizes valid hex values to lowercase with a leading #", () => {
    expect(normalizeHex("AB12CD")).toBe("#ab12cd");
    expect(normalizeHex("#ab12cd")).toBe("#ab12cd");
    expect(normalizeHex("ABCDEF")).toBe("#abcdef");
  });

  it("rejects a too-short string", () => {
    expect(normalizeHex("12345")).toBeNull();
  });

  it("rejects non-hex characters", () => {
    expect(normalizeHex("gggggg")).toBeNull();
  });

  it("rejects a path-like string", () => {
    expect(normalizeHex("aa/bb/cc")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(normalizeHex("")).toBeNull();
  });

  it("rejects non-6-digit forms", () => {
    expect(normalizeHex("#abc")).toBeNull();
    expect(normalizeHex("abcdefa")).toBeNull();
    expect(normalizeHex("##abcdef")).toBeNull();
  });
});

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
