import { DENYLIST } from "./denylist";

export const MAX_LABEL_LENGTH = 60;

const HEX_COLOUR_PATTERN = /^#?[0-9a-fA-F]{6}$/;

export function normalizeHex(raw: string): string | null {
  if (!HEX_COLOUR_PATTERN.test(raw)) return null;
  return `#${raw.replace(/^#/, "").toLowerCase()}`;
}

export function sanitizeLabel(raw: string): string {
  return raw.replace(/[<>{}[\]\\]/g, "").replace(/\p{Cc}/gu, "").trim();
}

export function isValidLabel(label: string): boolean {
  return label.length >= 1 && label.length <= MAX_LABEL_LENGTH;
}

export function isDenylisted(label: string): boolean {
  const normalized = label.toLowerCase();
  return DENYLIST.some((term) => normalized.includes(term));
}
