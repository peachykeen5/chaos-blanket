import { useEffect, useState } from "react";
import { PaletteIcon, RulerIcon } from "../../components/icons";
import { fetchLabeledItems } from "../../lib/lists";
import { projectColoursCollectionPath } from "../../lib/paths";
import type { ColourItem } from "../../types";
import { fetchHistory } from "../generate/generateApi";

interface ProjectSummaryCardProps {
  uid: string;
  projectId: string;
  refreshKey: number;
}

export function ProjectSummaryCard({ uid, projectId, refreshKey }: ProjectSummaryCardProps) {
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [colourCount, setColourCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [history, colours] = await Promise.all([
        fetchHistory(uid, projectId),
        fetchLabeledItems<ColourItem>(projectColoursCollectionPath(uid, projectId)),
      ]);
      if (cancelled) return;
      setTotalRows(history.reduce((sum, entry) => sum + entry.rowCount, 0));
      setColourCount(colours.length);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [uid, projectId, refreshKey]);

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-extrabold text-[#130E26]">Project Summary</h2>

      <div className="mt-5 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F36D00]/[0.1] text-[#F36D00]">
          <RulerIcon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[#A39EB9]">
            Total Depth
          </div>
          <div className="font-bold text-[#130E26]">
            {totalRows === null ? "–" : totalRows} rows completed
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#B0176C]/[0.1] text-[#B0176C]">
          <PaletteIcon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[#A39EB9]">
            Color Palette
          </div>
          <div className="font-bold text-[#130E26]">
            {colourCount === null ? "–" : colourCount} colors available
          </div>
        </div>
      </div>
    </div>
  );
}
