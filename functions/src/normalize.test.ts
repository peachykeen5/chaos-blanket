import { describe, expect, it } from "vitest";
import { computeGlobalKey } from "./normalize";

describe("computeGlobalKey", () => {
  it("normalizes a label with no hex: lowercase, trim, spaces to hyphens", () => {
    expect(computeGlobalKey("  Double Crochet  ")).toBe("double-crochet");
  });

  it("strips punctuation from a label-only key", () => {
    expect(computeGlobalKey("Moss-Stitch!!")).toBe("moss-stitch");
  });

  it("keys on hex, ignoring the label entirely, when hex is present", () => {
    expect(computeGlobalKey("Coral", "#FF7F50")).toBe("ff7f50");
    expect(computeGlobalKey("Sunset Orange", "#FF7F50")).toBe("ff7f50");
  });

  it("keys two different hexes for the same label as different entries", () => {
    expect(computeGlobalKey("Coral", "#FF7F50")).not.toBe(
      computeGlobalKey("Coral", "#FF6F61")
    );
  });
});
