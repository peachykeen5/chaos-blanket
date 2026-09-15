import { useState } from "react";
import { addLabeledItemWithHex, fetchLabeledItems } from "../../lib/lists";
import {
  projectColoursCollectionPath,
  projectStitchesCollectionPath,
} from "../../lib/paths";
import type { Project } from "../../types";

interface Item {
  id: string;
  label: string;
  hex?: string;
}

interface AddToProjectPickerProps {
  uid: string;
  kind: "stitch" | "colour";
  item: Item;
  projects: Project[];
  onDone: () => Promise<void>;
}

export function AddToProjectPicker({
  uid,
  kind,
  item,
  projects,
  onDone,
}: AddToProjectPickerProps) {
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [justSucceeded, setJustSucceeded] = useState(false);

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
      setJustSucceeded(true);
      setTimeout(() => setJustSucceeded(false), 2000);
    } catch {
      setWriteError("Couldn't save that — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="flex flex-col text-xs">
      <span className="flex items-center gap-1">
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
        {justSucceeded && (
          <span className="ml-1 text-xs text-green-600">Added ✓</span>
        )}
      </span>
      {writeError && (
        <span className="mt-1 block text-sm text-red-600">{writeError}</span>
      )}
    </span>
  );
}
