import { useState } from "react";
import type { Project } from "../../types";
import { HistoryList } from "../history/HistoryList";
import { GeneratePanel } from "./GeneratePanel";

interface GenerateAndHistoryPanelProps {
  uid: string;
  project: Project;
}

export function GenerateAndHistoryPanel({
  uid,
  project,
}: GenerateAndHistoryPanelProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="mt-6 border-t border-gray-200 pt-4">
      <GeneratePanel
        uid={uid}
        project={project}
        onGenerated={async () => setRefreshKey((k) => k + 1)}
      />
      <HistoryList uid={uid} projectId={project.id} refreshKey={refreshKey} />
    </div>
  );
}
