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
    const [stitches, colours] = await Promise.all([
      fetchLabeledItems(projectStitchesCollectionPath(uid, project.id)),
      fetchLabeledItems(projectColoursCollectionPath(uid, project.id)),
    ]);
    setStitchCount(stitches.length);
    setColourCount(colours.length);
  }

  useEffect(() => {
    void reloadCounts();
  }, [uid, project.id]);

  const disabledReason =
    stitchCount === null || colourCount === null
      ? "Loading…"
      : stitchCount === 0
      ? "Add at least one stitch first."
      : colourCount === 0
      ? "Add at least one colour first."
      : !isValidRowRange(project.rowMin, project.rowMax)
      ? "Fix this project's row range first."
      : null;

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
        disabled={disabledReason !== null}
        className="rounded bg-purple-600 px-3 py-1 text-sm text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        Generate
      </button>
      {disabledReason && (
        <p className="mt-1 text-xs text-gray-500">{disabledReason}</p>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
