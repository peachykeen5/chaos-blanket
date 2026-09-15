import { useEffect, useState } from "react";
import { deleteItem } from "../../lib/lists";
import { projectHistoryCollectionPath } from "../../lib/paths";
import type { HistoryEntry } from "../../types";
import { fetchHistory } from "../generate/generateApi";

interface HistoryListProps {
  uid: string;
  projectId: string;
  refreshKey: number;
}

export function HistoryList({ uid, projectId, refreshKey }: HistoryListProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  async function reload() {
    setEntries(await fetchHistory(uid, projectId));
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, projectId, refreshKey]);

  async function handleDelete(entryId: string) {
    await deleteItem(projectHistoryCollectionPath(uid, projectId), entryId);
    await reload();
  }

  return (
    <div className="mt-4">
      <h3 className="font-semibold text-gray-900">History</h3>
      <ul className="mt-2 space-y-1">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-2 text-sm">
            <span>
              {entry.rowCount} rows of {entry.stitchLabel} in {entry.colourLabel}
              {entry.colourHex ? ` (${entry.colourHex})` : ""}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(entry.id)}
              className="text-xs text-red-600 underline"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
