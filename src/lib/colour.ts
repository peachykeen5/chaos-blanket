/** Classifies a hex colour's tone so callers can pick readable foreground text/chrome. */
export function backgroundTone(hex: string): "light" | "dark" {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return "dark";
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "light" : "dark";
}
