import { describe, expect, it } from "vitest";
import { normalizeLabel } from "./normalize";

describe("normalizeLabel", () => {
  it("lowercases and trims", () => {
    expect(normalizeLabel("  Red  ")).toBe("red");
  });

  it("treats differently-cased, differently-spaced labels as equal", () => {
    expect(normalizeLabel("Double Crochet")).toBe(
      normalizeLabel("  double crochet ")
    );
  });
});
