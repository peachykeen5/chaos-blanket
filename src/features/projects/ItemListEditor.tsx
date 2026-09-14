import { useEffect, useState } from "react";
import {
  bulkAddLabels,
  deleteItem,
  fetchLabeledItems,
  updateColourHex,
} from "../../lib/lists";

interface Item {
  id: string;
  label: string;
  hex?: string;
}

interface ItemListEditorProps {
  title: string;
  collectionPath: string;
  supportsHex: boolean;
}

export function ItemListEditor({
  title,
  collectionPath,
  supportsHex,
}: ItemListEditorProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [bulkText, setBulkText] = useState("");
  const [loading, setLoading] = useState(true);
  const [writeError, setWriteError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setItems(await fetchLabeledItems<Item>(collectionPath));
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, [collectionPath]);

  // Every write below keeps the textarea/list untouched on failure (there's
  // no optimistic local update to roll back — reload() only runs after a
  // write succeeds) and surfaces an inline message next to this list, per
  // the spec's Error Handling section.
  async function handleBulkAdd() {
    setWriteError(null);
    try {
      await bulkAddLabels(
        collectionPath,
        bulkText,
        items.map((item) => item.label)
      );
      setBulkText("");
      await reload();
    } catch {
      setWriteError("Couldn't save that — check your connection and try again.");
    }
  }

  async function handleDelete(itemId: string) {
    setWriteError(null);
    try {
      await deleteItem(collectionPath, itemId);
      await reload();
    } catch {
      setWriteError("Couldn't delete that — check your connection and try again.");
    }
  }

  async function handleHexChange(itemId: string, hex: string) {
    setWriteError(null);
    try {
      await updateColourHex(collectionPath, itemId, hex);
      await reload();
    } catch {
      setWriteError("Couldn't save that hex — check your connection and try again.");
    }
  }

  return (
    <div className="mt-4">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <textarea
        className="mt-2 w-full rounded border border-gray-300 p-2 text-sm"
        rows={3}
        placeholder="Paste one per line"
        value={bulkText}
        onChange={(e) => setBulkText(e.target.value)}
      />
      <button
        type="button"
        onClick={handleBulkAdd}
        className="mt-2 rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
      >
        Add
      </button>
      {writeError && <p className="mt-1 text-sm text-red-600">{writeError}</p>}
      {loading ? (
        <p className="mt-2 text-sm text-gray-500">Loading…</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <span>{item.label}</span>
              {supportsHex && (
                <input
                  type="text"
                  placeholder="#hex"
                  defaultValue={item.hex ?? ""}
                  onBlur={(e) => {
                    if (e.target.value)
                      void handleHexChange(item.id, e.target.value);
                  }}
                  className="w-20 rounded border border-gray-300 px-1 text-xs"
                />
              )}
              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                className="text-xs text-red-600 underline"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
