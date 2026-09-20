import type { Timestamp } from "firebase/firestore";

export interface UserDoc {
  displayName: string;
  email: string;
  createdAt: Timestamp | null;
}

export interface Project {
  id: string;
  name: string;
  rowMin: number;
  rowMax: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

/** A Stitch or Colour Item as stored in a Project List or the Account Library. */
export interface StitchItem {
  id: string;
  label: string;
}

export interface ColourItem {
  id: string;
  label: string;
  hex?: string;
}

/** The persisted record of one Segment (see CONTEXT.md). */
export interface HistoryEntry {
  id: string;
  stitchLabel: string;
  colourLabel: string;
  colourHex?: string;
  rowCount: number;
  generatedAt: Timestamp | null;
}
