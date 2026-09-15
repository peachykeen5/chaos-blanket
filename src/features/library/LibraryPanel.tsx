import { useEffect, useState } from "react";
import {
  colourLibraryCollectionPath,
  stitchLibraryCollectionPath,
} from "../../lib/paths";
import type { Project } from "../../types";
import { ItemListEditor } from "../projects/ItemListEditor";
import { listProjects } from "../projects/projectsApi";
import { AddToProjectPicker } from "./AddToProjectPicker";

interface LibraryPanelProps {
  uid: string;
  refreshKey: number;
  onCrossPanelChange: () => void;
}

export function LibraryPanel({
  uid,
  refreshKey,
  onCrossPanelChange,
}: LibraryPanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    listProjects(uid)
      .then(setProjects)
      .catch((err) => {
        console.error("listProjects failed", err);
      });
  }, [uid, refreshKey]);

  return (
    <div className="mt-6 border-t border-gray-200 pt-4">
      <h2 className="font-semibold text-gray-900">Your library</h2>
      <ItemListEditor
        title="Stitches"
        collectionPath={stitchLibraryCollectionPath(uid)}
        supportsHex={false}
        refreshKey={refreshKey}
        renderExtraAction={(item) => (
          <AddToProjectPicker
            uid={uid}
            kind="stitch"
            item={item}
            projects={projects}
            onDone={async () => {
              onCrossPanelChange();
            }}
          />
        )}
      />
      <ItemListEditor
        title="Colours"
        collectionPath={colourLibraryCollectionPath(uid)}
        supportsHex
        refreshKey={refreshKey}
        renderExtraAction={(item) => (
          <AddToProjectPicker
            uid={uid}
            kind="colour"
            item={item}
            projects={projects}
            onDone={async () => {
              onCrossPanelChange();
            }}
          />
        )}
      />
    </div>
  );
}
