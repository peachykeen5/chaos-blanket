import { useState } from "react";
import type { Project } from "../../types";
import { HistoryList } from "../history/HistoryList";
import { ProjectSummaryCard } from "../projects/ProjectSummaryCard";
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
    <div className="mt-6 flex flex-col gap-6">
      <GeneratePanel
        uid={uid}
        project={project}
        refreshKey={refreshKey}
        onGenerated={async () => setHistoryRefreshKey((k) => k + 1)}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HistoryList
            uid={uid}
            projectId={project.id}
            refreshKey={historyRefreshKey}
            onChanged={() => setHistoryRefreshKey((k) => k + 1)}
          />
        </div>
        <ProjectSummaryCard uid={uid} projectId={project.id} refreshKey={historyRefreshKey} />
      </div>
    </div>
  );
}
