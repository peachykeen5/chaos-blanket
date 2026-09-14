export function computeGlobalKey(label: string, hex?: string): string {
  if (hex) {
    return hex.trim().replace(/^#/, "").toLowerCase();
  }
  return label
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
}
