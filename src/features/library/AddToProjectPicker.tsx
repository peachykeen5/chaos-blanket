import { useEffect, useState } from "react";
import { addLabeledItemWithHex, fetchLabeledItems } from "../../lib/lists";
import {
  projectColoursCollectionPath,
  projectStitchesCollectionPath,
} from "../../lib/paths";
import type { Project } from "../../types";
import { listProjects } from "../projects/projectsApi";

interface Item {
  id: string;
  label: string;
  hex?: string;
}

interface AddToProjectPickerProps {
  uid: string;
  kind: "stitch" | "colour";
  item: Item;
  onDone: () => Promise<void>;
}

export function AddToProjectPicker({
  uid,
  kind,
  item,
  onDone,
}: AddToProjectPickerProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  useEffect(() => {
    void listProjects(uid).then(setProjects);
  }, [uid]);

  async function handleAdd() {
    if (!selectedProjectId) return;
    setWriteError(null);
    setLoading(true);
    try {
      const collectionPath =
        kind === "stitch"
          ? projectStitchesCollectionPath(uid, selectedProjectId)
          : projectColoursCollectionPath(uid, selectedProjectId);
      const existing = await fetchLabeledItems<Item>(collectionPath);
      await addLabeledItemWithHex(
        collectionPath,
        item,
        existing.map((i) => i.label)
      );
      await onDone();
    } catch {
      setWriteError("Couldn't save that — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="flex items-center gap-1 text-xs">
      <select
        value={selectedProjectId}
        onChange={(e) => setSelectedProjectId(e.target.value)}
        className="rounded border border-gray-300 text-xs"
      >
        <option value="">Add to project…</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleAdd}
        disabled={loading}
        className="text-blue-600 underline"
      >
        Add
      </button>
      {writeError && <p className="mt-1 text-sm text-red-600">{writeError}</p>}
    </span>
  );
}
