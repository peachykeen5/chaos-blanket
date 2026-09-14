import { normalizeLabel } from "./normalize";

export function parseBulkPaste(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const rawLine of text.split("\n")) {
    const label = rawLine.trim();
    if (!label) continue;
    const key = normalizeLabel(label);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}

export function dedupeAgainstExisting(
  candidates: string[],
  existingLabels: string[]
): string[] {
  const existingKeys = new Set(existingLabels.map(normalizeLabel));
  return candidates.filter((label) => !existingKeys.has(normalizeLabel(label)));
}
