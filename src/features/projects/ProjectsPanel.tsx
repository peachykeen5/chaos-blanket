import { useEffect, useState } from "react";
import {
  projectColoursCollectionPath,
  projectStitchesCollectionPath,
} from "../../lib/paths";
import type { Project } from "../../types";
import { ItemListEditor } from "./ItemListEditor";
import {
  createProject,
  deleteProject,
  isValidRowRange,
  listProjects,
  renameProject,
  updateRowRange,
} from "./projectsApi";

interface ProjectsPanelProps {
  uid: string;
}

export function ProjectsPanel({ uid }: ProjectsPanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [rowMin, setRowMin] = useState(2);
  const [rowMax, setRowMax] = useState(6);
  const [formError, setFormError] = useState<string | null>(null);
  const [editRowMin, setEditRowMin] = useState<number | null>(null);
  const [editRowMax, setEditRowMax] = useState<number | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  async function reload() {
    try {
      setProjects(await listProjects(uid));
    } catch {
      setFormError("Couldn't load your projects — check your connection and try again.");
    }
  }

  useEffect(() => {
    void reload();
  }, [uid]);

  async function handleCreate() {
    if (!isValidRowRange(rowMin, rowMax)) {
      setFormError("Row min must be a whole number no greater than row max.");
      return;
    }
    setFormError(null);
    try {
      await createProject(uid, { name, rowMin, rowMax });
      setName("");
      await reload();
    } catch {
      setFormError("Couldn't create the project — check your connection and try again.");
    }
  }

  async function handleDelete(projectId: string) {
    setFormError(null);
    try {
      await deleteProject(uid, projectId);
      if (selectedId === projectId) setSelectedId(null);
      await reload();
    } catch {
      setFormError("Couldn't delete the project — check your connection and try again.");
    }
  }

  const selected = projects.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) {
      setEditRowMin(selected.rowMin);
      setEditRowMax(selected.rowMax);
      setEditError(null);
    }
  }, [selected?.id]);

  async function handleRename(name: string) {
    if (!selected || !name || name === selected.name) return;
    setEditError(null);
    try {
      await renameProject(uid, selected.id, name);
      await reload();
    } catch {
      setEditError("Couldn't rename the project — check your connection and try again.");
    }
  }

  async function handleRowRangeSave() {
    if (!selected || editRowMin === null || editRowMax === null) return;
    setEditError(null);
    try {
      await updateRowRange(uid, selected.id, editRowMin, editRowMax);
      await reload();
    } catch {
      setEditError(
        "Couldn't update the row range — check that row min is a whole number no greater than row max."
      );
    }
  }

  return (
    <div className="mt-6">
      <h2 className="font-semibold text-gray-900">Projects</h2>
      <ul className="mt-2 space-y-1">
        {projects.map((project) => (
          <li key={project.id} className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setSelectedId(project.id)}
              className="underline"
            >
              {project.name}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(project.id)}
              className="text-xs text-red-600 underline"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <input
          type="text"
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <input
          type="number"
          value={rowMin}
          onChange={(e) => setRowMin(Number(e.target.value))}
          className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <input
          type="number"
          value={rowMax}
          onChange={(e) => setRowMax(Number(e.target.value))}
          className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={handleCreate}
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
        >
          Create project
        </button>
      </div>
      {formError && <p className="mt-1 text-sm text-red-600">{formError}</p>}

      {selected && (
        <div className="mt-6 border-t border-gray-200 pt-4">
          <div className="flex flex-wrap items-end gap-2">
            <input
              type="text"
              defaultValue={selected.name}
              key={selected.id}
              onBlur={(e) => void handleRename(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-sm font-semibold"
            />
            <input
              type="number"
              value={editRowMin ?? ""}
              onChange={(e) => setEditRowMin(Number(e.target.value))}
              className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <input
              type="number"
              value={editRowMax ?? ""}
              onChange={(e) => setEditRowMax(Number(e.target.value))}
              className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={handleRowRangeSave}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
            >
              Save row range
            </button>
          </div>
          {editError && <p className="mt-1 text-sm text-red-600">{editError}</p>}
          <ItemListEditor
            title="Stitches"
            collectionPath={projectStitchesCollectionPath(uid, selected.id)}
            supportsHex={false}
          />
          <ItemListEditor
            title="Colours"
            collectionPath={projectColoursCollectionPath(uid, selected.id)}
            supportsHex
          />
        </div>
      )}
    </div>
  );
}
