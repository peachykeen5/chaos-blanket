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
      // Background contribution to the global pool — intentionally
      // un-awaited and outside this try/catch; its own failure shouldn't
      // block or fail the library save.
      void contributeItem(kind, item.label, item.hex);
      await onDone();
    } catch {
      setWriteError("Couldn't save that — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="text-xs text-green-700 underline"
      >
        Save to library
      </button>
      {writeError && <p className="mt-1 text-sm text-red-600">{writeError}</p>}
    </span>
  );
}
