import { useState } from "react";
import { addLabeledItemWithHex, fetchLabeledItems } from "../../lib/lists";
import { contributeItem } from "../../lib/contribute";
import {
  colourLibraryCollectionPath,
  stitchLibraryCollectionPath,
} from "../../lib/paths";

interface Item {
  id: string;
  label: string;
  hex?: string;
}

interface SaveToLibraryButtonProps {
  uid: string;
  kind: "stitch" | "colour";
  item: Item;
  onDone: () => Promise<void>;
}

export function SaveToLibraryButton({
  uid,
  kind,
  item,
  onDone,
}: SaveToLibraryButtonProps) {
  const [loading, setLoading] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [justSucceeded, setJustSucceeded] = useState(false);
  const libraryPath =
    kind === "stitch"
      ? stitchLibraryCollectionPath(uid)
      : colourLibraryCollectionPath(uid);

  async function handleClick() {
    setWriteError(null);
    setLoading(true);
    try {
      const existing = await fetchLabeledItems<Item>(libraryPath);
      await addLabeledItemWithHex(
        libraryPath,
        item,
        existing.map((i) => i.label)
      );
      // Background contribution to the Global Pool — Stitches only, since
      // the Global Pool no longer accepts Colours. Un-awaited — its
      // rejection never reaches this catch, and it swallows its own errors
      // internally.
      if (kind === "stitch") {
        void contributeItem(item.label);
      }
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
    <span className="flex flex-col">
      <span className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="text-xs text-green-700 underline"
        >
          Save to library
        </button>
        {justSucceeded && (
          <span className="ml-1 text-xs text-green-600">Saved ✓</span>
        )}
      </span>
      {writeError && (
        <span className="mt-1 block text-sm text-red-600">{writeError}</span>
      )}
    </span>
  );
}
