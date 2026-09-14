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
  const libraryPath =
    kind === "stitch"
      ? stitchLibraryCollectionPath(uid)
      : colourLibraryCollectionPath(uid);

  async function handleClick() {
    const existing = await fetchLabeledItems<Item>(libraryPath);
    await addLabeledItemWithHex(
      libraryPath,
      item,
      existing.map((i) => i.label)
    );
    void contributeItem(kind, item.label, item.hex);
    await onDone();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-xs text-green-700 underline"
    >
      Save to library
    </button>
  );
}
