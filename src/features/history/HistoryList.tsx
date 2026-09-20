import { useEffect, useState } from "react";
import { InlineError } from "../../components";
import { fetchLabeledItems } from "../../lib/lists";
import { projectColoursCollectionPath, projectStitchesCollectionPath } from "../../lib/paths";
import type { ColourItem, HistoryEntry, StitchItem } from "../../types";
import { fetchHistory } from "../generate/generateApi";
import { HistoryRow } from "./HistoryRow";

interface HistoryListProps {
  uid: string;
  projectId: string;
  refreshKey: number;
  highlightedEntryId?: string | null;
  onChanged: () => void;
}

function buildPatternText(entries: HistoryEntry[]): string {
  return [...entries]
    .reverse()
    .map((entry, index) => {
      const step = index + 1;
      const colour = entry.colourHex ? `${entry.colourLabel} (${entry.colourHex})` : entry.colourLabel;
      return `#${step}: ${entry.rowCount} row${entry.rowCount === 1 ? "" : "s"} of ${entry.stitchLabel} in ${colour}`;
    })
    .join("\n");
}

export function HistoryList({
  uid,
  projectId,
  refreshKey,
  highlightedEntryId,
  onChanged,
}: HistoryListProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [stitchOptions, setStitchOptions] = useState<StitchItem[]>([]);
  const [colourOptions, setColourOptions] = useState<ColourItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function reload() {
    try {
      const [history, stitches, colours] = await Promise.all([
        fetchHistory(uid, projectId),
        fetchLabeledItems<StitchItem>(projectStitchesCollectionPath(uid, projectId)),
        fetchLabeledItems<ColourItem>(projectColoursCollectionPath(uid, projectId)),
      ]);
      setEntries(history);
      setStitchOptions(stitches);
      setColourOptions(colours);
      setError(null);
    } catch {
      setError("Couldn't load history — check your connection and try again.");
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, projectId, refreshKey]);

  async function handleExport() {
    try {
      await navigator.clipboard.writeText(buildPatternText(entries));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy the pattern to your clipboard.");
    }
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-extrabold text-[#130E26]">History</h2>
          <span className="rounded-full bg-[#B0176C]/10 px-3 py-1 text-xs font-semibold text-[#B0176C]">
            {entries.length} Step{entries.length === 1 ? "" : "s"}
          </span>
        </div>
        {entries.length > 0 && (
          <button
            type="button"
            onClick={handleExport}
            className="text-sm font-semibold text-[#B0176C] hover:text-[#93125A]"
          >
            {copied ? "Copied!" : "Export Pattern"}
          </button>
        )}
      </div>

      {error && <InlineError className="mt-3">{error}</InlineError>}

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-[#726E8D]">
          No steps yet. Generate your first pattern step to get started.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {entries.map((entry, index) => (
            <HistoryRow
              key={entry.id}
              uid={uid}
              projectId={projectId}
              entry={entry}
              stepNumber={entries.length - index}
              stitchOptions={stitchOptions}
              colourOptions={colourOptions}
              isNew={entry.id === highlightedEntryId}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
}
