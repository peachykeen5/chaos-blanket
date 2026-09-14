import {
  colourLibraryCollectionPath,
  stitchLibraryCollectionPath,
} from "../../lib/paths";
import { ItemListEditor } from "../projects/ItemListEditor";
import { AddToProjectPicker } from "./AddToProjectPicker";

interface LibraryPanelProps {
  uid: string;
}

export function LibraryPanel({ uid }: LibraryPanelProps) {
  return (
    <div className="mt-6 border-t border-gray-200 pt-4">
      <h2 className="font-semibold text-gray-900">Your library</h2>
      <ItemListEditor
        title="Stitches"
        collectionPath={stitchLibraryCollectionPath(uid)}
        supportsHex={false}
        renderExtraAction={(item, reload) => (
          <AddToProjectPicker uid={uid} kind="stitch" item={item} onDone={reload} />
        )}
      />
      <ItemListEditor
        title="Colours"
        collectionPath={colourLibraryCollectionPath(uid)}
        supportsHex
        renderExtraAction={(item, reload) => (
          <AddToProjectPicker uid={uid} kind="colour" item={item} onDone={reload} />
        )}
      />
    </div>
  );
}
