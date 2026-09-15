import { describe, expect, it } from "vitest";
import { pickRandomInclusive, pickRandomItem } from "./random";

describe("pickRandomInclusive", () => {
  it("returns the fixed value when min equals max, regardless of randomness", () => {
    expect(pickRandomInclusive(4, 4, () => 0)).toBe(4);
    expect(pickRandomInclusive(4, 4, () => 0.999)).toBe(4);
  });

  it("returns min when the random source returns 0", () => {
    expect(pickRandomInclusive(2, 6, () => 0)).toBe(2);
  });

  it("returns max when the random source returns just under 1 (inclusive upper bound)", () => {
    expect(pickRandomInclusive(2, 6, () => 0.999999)).toBe(6);
  });
});

describe("pickRandomItem", () => {
  it("picks the item at the index implied by the random source", () => {
    expect(pickRandomItem(["a", "b", "c"], () => 0)).toBe("a");
    expect(pickRandomItem(["a", "b", "c"], () => 0.999)).toBe("c");
  });

  it("throws on an empty list", () => {
    expect(() => pickRandomItem([], () => 0)).toThrow();
  });
});
