import { DENYLIST } from "./denylist";

export const MAX_LABEL_LENGTH = 60;

export function sanitizeLabel(raw: string): string {
  return raw.replace(/[<>{}[\]\\]/g, "").trim();
}

export function isValidLabel(label: string): boolean {
  return label.length >= 1 && label.length <= MAX_LABEL_LENGTH;
}

export function isDenylisted(label: string): boolean {
  const normalized = label.toLowerCase();
  return DENYLIST.some((term) => normalized.includes(term));
}
