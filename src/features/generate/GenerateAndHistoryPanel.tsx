import { useState } from "react";
import type { Project } from "../../types";
import { HistoryList } from "../history/HistoryList";
import { GeneratePanel } from "./GeneratePanel";

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

  return (
    <div className="mt-6 border-t border-gray-200 pt-4">
      <GeneratePanel
        uid={uid}
        project={project}
        refreshKey={refreshKey}
        onGenerated={async () => setHistoryRefreshKey((k) => k + 1)}
      />
      <HistoryList uid={uid} projectId={project.id} refreshKey={historyRefreshKey} />
    </div>
  );
}
