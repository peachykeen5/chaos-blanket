import { useEffect, useState } from "react";
import { fetchLabeledItems } from "../../lib/lists";
import {
  projectColoursCollectionPath,
  projectStitchesCollectionPath,
} from "../../lib/paths";
import type { Project } from "../../types";
import { isValidRowRange } from "../projects/projectsApi";
import { generateSegment } from "./generateApi";

interface GeneratePanelProps {
  uid: string;
  project: Project;
  onGenerated: () => Promise<void>;
}

export function GeneratePanel({ uid, project, onGenerated }: GeneratePanelProps) {
  const [stitchCount, setStitchCount] = useState<number | null>(null);
  const [colourCount, setColourCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reloadCounts() {
    try {
      const [stitches, colours] = await Promise.all([
        fetchLabeledItems(projectStitchesCollectionPath(uid, project.id)),
        fetchLabeledItems(projectColoursCollectionPath(uid, project.id)),
      ]);
      setStitchCount(stitches.length);
      setColourCount(colours.length);
    } catch {
      setError("Couldn't load stitches/colours — check your connection and try again.");
    }
  }

  useEffect(() => {
    void reloadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, project.id]);

  // Counts not having loaded yet is handled separately from disabledReason
  // below (as a "Loading…" placeholder, or the `error` message if the load
  // failed) rather than folded into disabledReason itself — that keeps the
  // button correctly disabled either way without disabledReason's plain
  // truthy-string check misreading a load failure as "nothing wrong, enable
  // the button".
  const countsLoaded = stitchCount !== null && colourCount !== null;

  const disabledReason = !countsLoaded
    ? null
    : stitchCount === 0
    ? "Add at least one stitch first."
    : colourCount === 0
    ? "Add at least one colour first."
    : !isValidRowRange(project.rowMin, project.rowMax)
    ? "Fix this project's row range first."
    : null;

  // Reusing the single `error` state for both this mount-time load failure
  // and Generate-click failures: they're mutually exclusive in time (a
  // failed load leaves countsLoaded false, which keeps the button disabled,
  // so there's no click to fail afterwards) and the UI only ever needs to
  // show one error message at a time.
  async function handleClick() {
    setError(null);
    try {
      await generateSegment(uid, project);
      await reloadCounts();
      await onGenerated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed.");
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleClick}
        disabled={!countsLoaded || disabledReason !== null}
        className="rounded bg-purple-600 px-3 py-1 text-sm text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        Generate
      </button>
      {!countsLoaded && !error && (
        <p className="mt-1 text-xs text-gray-500">Loading…</p>
      )}
      {disabledReason && (
        <p className="mt-1 text-xs text-gray-500">{disabledReason}</p>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
