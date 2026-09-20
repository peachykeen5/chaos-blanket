import { useEffect, useRef, useState } from "react";
import type { Project } from "../../types";
import { HistoryList } from "../history/HistoryList";
import { ProjectSummaryCard } from "../projects/ProjectSummaryCard";
import { GeneratePanel } from "./GeneratePanel";

const HIGHLIGHT_DURATION_MS = 2200;

interface GenerateAndHistoryPanelProps {
  uid: string;
  project: Project;
  refreshKey: number;
}

export function GenerateAndHistoryPanel({
  uid,
  project,
  refreshKey,
}: GenerateAndHistoryPanelProps) {
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  async function handleGenerated(newEntryId: string) {
    setHistoryRefreshKey((k) => k + 1);
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    setHighlightedEntryId(newEntryId);
    highlightTimeoutRef.current = setTimeout(
      () => setHighlightedEntryId(null),
      HIGHLIGHT_DURATION_MS
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <GeneratePanel
        uid={uid}
        project={project}
        refreshKey={refreshKey}
        onGenerated={handleGenerated}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HistoryList
            uid={uid}
            projectId={project.id}
            refreshKey={historyRefreshKey}
            highlightedEntryId={highlightedEntryId}
            onChanged={() => setHistoryRefreshKey((k) => k + 1)}
          />
        </div>
        <ProjectSummaryCard uid={uid} projectId={project.id} refreshKey={historyRefreshKey} />
      </div>
    </div>
  );
}
