import { describe, expect, it } from "vitest";
import { computeGlobalKey } from "./normalize";

describe("computeGlobalKey", () => {
  it("normalizes a label: lowercase, trim, spaces to hyphens", () => {
    expect(computeGlobalKey("  Double Crochet  ")).toBe("double-crochet");
  });

  it("strips punctuation from the key", () => {
    expect(computeGlobalKey("Moss-Stitch!!")).toBe("moss-stitch");
  });
});
