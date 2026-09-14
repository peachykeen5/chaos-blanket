import { describe, expect, it } from "vitest";
import { dedupeAgainstExisting, parseBulkPaste } from "./bulkPaste";

describe("parseBulkPaste", () => {
  it("splits on newlines, trims, and drops blank lines", () => {
    expect(parseBulkPaste("Red\n  Blue  \n\nGreen")).toEqual([
      "Red",
      "Blue",
      "Green",
    ]);
  });

  it("drops duplicates within the pasted batch, case-insensitively, keeping the first occurrence", () => {
    expect(parseBulkPaste("Red\nred\nRED\nBlue")).toEqual(["Red", "Blue"]);
  });
});

describe("dedupeAgainstExisting", () => {
  it("filters out candidates already present in the existing list, case-insensitively", () => {
    expect(
      dedupeAgainstExisting(["Red", "Green", "blue"], ["red", "Blue"])
    ).toEqual(["Green"]);
  });

  it("returns all candidates when nothing overlaps", () => {
    expect(dedupeAgainstExisting(["Red"], ["Green"])).toEqual(["Red"]);
  });
});
