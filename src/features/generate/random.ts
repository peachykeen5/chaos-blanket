export function pickRandomInclusive(
  min: number,
  max: number,
  random: () => number = Math.random
): number {
  return min + Math.floor(random() * (max - min + 1));
}

export function pickRandomItem<T>(
  items: T[],
  random: () => number = Math.random
): T {
  if (items.length === 0) {
    throw new Error("Cannot pick from an empty list");
  }
  return items[Math.floor(random() * items.length)];
}
