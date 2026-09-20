import { useState } from "react";
import clsx from "clsx";
import { Button, ConfirmModal, InlineError, Select, TextInput } from "../../components";
import { TrashIcon } from "../../components/icons";
import { backgroundTone } from "../../lib/colour";
import { deleteItem } from "../../lib/lists";
import { projectHistoryCollectionPath } from "../../lib/paths";
import type { ColourItem, HistoryEntry, StitchItem } from "../../types";
import { updateHistoryEntry } from "../generate/generateApi";

interface HistoryRowProps {
  uid: string;
  projectId: string;
  entry: HistoryEntry;
  stepNumber: number;
  stitchOptions: StitchItem[];
  colourOptions: ColourItem[];
  isNew?: boolean;
  onChanged: () => void;
}

const FALLBACK_COLOUR = "#B0176C";

export function HistoryRow({
  uid,
  projectId,
  entry,
  stepNumber,
  stitchOptions,
  colourOptions,
  isNew = false,
  onChanged,
}: HistoryRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [stitchLabel, setStitchLabel] = useState(entry.stitchLabel);
  const [colourLabel, setColourLabel] = useState(entry.colourLabel);
  const [rowCount, setRowCount] = useState(entry.rowCount);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function startEditing() {
    setStitchLabel(entry.stitchLabel);
    setColourLabel(entry.colourLabel);
    setRowCount(entry.rowCount);
    setError(null);
    setIsEditing(true);
  }

  async function handleSave() {
    if (!Number.isInteger(rowCount) || rowCount < 1) {
      setError("Rows must be a whole number of at least 1.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const colour = colourOptions.find((c) => c.label === colourLabel);
      await updateHistoryEntry(uid, projectId, entry.id, {
        stitchLabel,
        colourLabel,
        colourHex: colour?.hex,
        rowCount,
      });
      setIsEditing(false);
      onChanged();
    } catch {
      setError("Couldn't save this step — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteItem(projectHistoryCollectionPath(uid, projectId), entry.id);
      setConfirmingDelete(false);
      onChanged();
    } catch {
      setDeleteError("Couldn't delete this step — check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  }

  if (isEditing) {
    return (
      <div className="rounded-2xl border border-[#EEEAFF] bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-[#726E8D]">
            Stitch
            <Select
              className="mt-1 block w-40"
              value={stitchLabel}
              onChange={(e) => setStitchLabel(e.target.value)}
            >
              {stitchOptions.map((s) => (
                <option key={s.id} value={s.label}>
                  {s.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="text-sm text-[#726E8D]">
            Colour
            <Select
              className="mt-1 block w-44"
              value={colourLabel}
              onChange={(e) => setColourLabel(e.target.value)}
            >
              {colourOptions.map((c) => (
                <option key={c.id} value={c.label}>
                  {c.label}
                  {c.hex ? ` (${c.hex})` : ""}
                </option>
              ))}
            </Select>
          </label>

          <label className="text-sm text-[#726E8D]">
            Rows
            <TextInput
              type="number"
              min={1}
              className="mt-1 block w-20"
              value={rowCount}
              onChange={(e) => setRowCount(Number(e.target.value))}
            />
          </label>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="link" size="md" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="rounded-lg bg-[#B0176C] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#93125A] disabled:opacity-60"
            >
              Save
            </button>
          </div>
        </div>
        {error && <InlineError className="mt-2">{error}</InlineError>}
      </div>
    );
  }

  const colourHex = entry.colourHex ?? FALLBACK_COLOUR;
  const tone = backgroundTone(colourHex);
  const isLight = tone === "light";

  return (
    <div
      className={clsx(
        "flex items-center gap-4 rounded-2xl p-4",
        isNew && "animate-pulse-glow"
      )}
      style={{ backgroundColor: colourHex }}
    >
      <span
        className={clsx(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          isLight ? "bg-[#130E26]/10 text-[#130E26]" : "bg-white/20 text-white"
        )}
      >
        #{stepNumber}
      </span>

      <div className="min-w-0 flex-1">
        <div className={clsx("font-bold", isLight ? "text-[#130E26]" : "text-white")}>
          {entry.rowCount} row{entry.rowCount === 1 ? "" : "s"} of {entry.stitchLabel}
        </div>
        <div className={clsx("text-sm", isLight ? "text-[#130E26]/70" : "text-white/80")}>
          {entry.colourLabel}
          {entry.colourHex ? ` (${entry.colourHex})` : ""}
        </div>
        {error && <InlineError className="mt-1">{error}</InlineError>}
      </div>

      <button
        type="button"
        onClick={startEditing}
        className={clsx(
          "shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold",
          isLight ? "bg-[#130E26]/5 text-[#130E26] hover:bg-[#130E26]/10" : "bg-white/15 text-white hover:bg-white/25"
        )}
      >
        Edit
      </button>
      <button
        type="button"
        onClick={() => {
          setDeleteError(null);
          setConfirmingDelete(true);
        }}
        aria-label="Delete this step"
        className={clsx(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          isLight ? "bg-[#130E26]/5 text-[#130E26] hover:bg-[#130E26]/10" : "bg-white/10 text-white hover:bg-white/20"
        )}
      >
        <TrashIcon className="h-4 w-4" />
      </button>

      <ConfirmModal
        open={confirmingDelete}
        title="Delete this step?"
        message={`This will permanently remove "${entry.rowCount} row${entry.rowCount === 1 ? "" : "s"} of ${entry.stitchLabel}" from your history.`}
        confirmLabel="Delete"
        confirming={deleting}
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
