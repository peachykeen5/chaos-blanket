import { useEffect, useState } from "react";
import clsx from "clsx";
import { InlineError } from "../../components";
import { SparklesIcon } from "../../components/icons";
import { fetchLabeledItems } from "../../lib/lists";
import {
  projectColoursCollectionPath,
  projectStitchesCollectionPath,
} from "../../lib/paths";
import type { Project } from "../../types";
import { isValidRowRange } from "../projects/projectsApi";
import { generateSegment } from "./generateApi";

const MIN_GENERATING_MS = 1000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GeneratePanelProps {
  uid: string;
  project: Project;
  refreshKey: number;
  onGenerated: (newEntryId: string) => Promise<void>;
}

export function GeneratePanel({
  uid,
  project,
  refreshKey,
  onGenerated,
}: GeneratePanelProps) {
  const [stitchCount, setStitchCount] = useState<number | null>(null);
  const [colourCount, setColourCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function reloadCounts() {
    try {
      const [stitches, colours] = await Promise.all([
        fetchLabeledItems(projectStitchesCollectionPath(uid, project.id)),
        fetchLabeledItems(projectColoursCollectionPath(uid, project.id)),
      ]);
      setStitchCount(stitches.length);
      setColourCount(colours.length);
      setError(null);
    } catch {
      setError("Couldn't load stitches/colours — check your connection and try again.");
    }
  }

  useEffect(() => {
    void reloadCounts();
  }, [uid, project.id, refreshKey]);

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
  // and Generate-click failures. On a failed click, reloadCounts() runs
  // first so the disabled state re-syncs immediately (e.g. the project ran
  // out of stitches mid-session), then the click's own error message is set
  // afterward so it isn't clobbered by reloadCounts()'s own
  // setError(null)-on-success.
  async function handleClick() {
    setError(null);
    setGenerating(true);
    const startedAt = Date.now();
    try {
      const newEntryId = await generateSegment(uid, project);
      await reloadCounts();
      await onGenerated(newEntryId);
    } catch (err) {
      await reloadCounts();
      setError(err instanceof Error ? err.message : "Generate failed.");
    } finally {
      const remaining = MIN_GENERATING_MS - (Date.now() - startedAt);
      if (remaining > 0) await wait(remaining);
      setGenerating(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#130E26]">
            Ready for your next pattern step?
          </h2>
          <p className="mt-1 text-sm text-[#726E8D]">
            Generate a randomized combination of stitch type, yarn color, and row depth.
          </p>
          {!countsLoaded && !error && <p className="mt-1 text-xs text-[#A39EB9]">Loading…</p>}
          {disabledReason && <p className="mt-1 text-xs text-[#A39EB9]">{disabledReason}</p>}
        </div>

        <button
          type="button"
          onClick={handleClick}
          disabled={!countsLoaded || disabledReason !== null || generating}
          className={clsx(
            "flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-[#F36D00] to-[#B0176C] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:opacity-90 disabled:cursor-not-allowed",
            generating ? "scale-95 opacity-90" : "disabled:opacity-50"
          )}
        >
          <SparklesIcon className={clsx("h-4 w-4", generating && "animate-spin")} />
          {generating ? "Generating…" : "Generate"}
        </button>
      </div>
      {error && <InlineError className="mt-3">{error}</InlineError>}
    </div>
  );
}
