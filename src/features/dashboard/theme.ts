export const THEME_COLOURS = [
  "#F36D00",
  "#B0176C",
  "#973BE3",
  "#3DC1D3",
  "#FF9900",
  "#E0125C",
];

/** Deterministically picks a theme colour for a project so it stays stable across re-renders. */
export function themeColourForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return THEME_COLOURS[Math.abs(hash) % THEME_COLOURS.length];
}

export interface ProjectCardData {
  id: string;
  name: string;
  lastEditedLabel: string;
  rowsCompleted: number;
  yarnCount: number;
  lastStitchLabel: string;
  /** The hex of the most recently generated colour, if one has been recorded yet. */
  lastColourHex?: string;
}

export interface DashboardSummary {
  activeProjects: number;
  stitchesGenerated: number;
  happyAccidents: number;
}

/** No real "happy accidents" concept is tracked yet, so this stays a fun placeholder. */
export const HAPPY_ACCIDENTS_PLACEHOLDER = 187;
