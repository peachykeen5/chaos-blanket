import type { QueryDocumentSnapshot } from "firebase/firestore";
import { useState } from "react";
import type { GlobalItemDoc } from "../../types";
import { fetchGlobalPoolPage, pullIntoLibrary } from "./globalPoolApi";

interface GlobalPoolBrowserProps {
  kind: "stitch" | "colour";
  globalCollectionPath: string;
  libraryCollectionPath: string;
}

export function GlobalPoolBrowser({
  kind,
  globalCollectionPath,
  libraryCollectionPath,
}: GlobalPoolBrowserProps) {
  const [prefix, setPrefix] = useState("");
  const [items, setItems] = useState<GlobalItemDoc[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);

  async function search(reset: boolean) {
    const page = await fetchGlobalPoolPage(globalCollectionPath, {
      prefix: prefix || undefined,
      after: reset ? null : lastDoc,
    });
    setItems(reset ? page.items : [...items, ...page.items]);
    setLastDoc(page.lastDoc);
    setHasMore(page.items.length === 30);
  }

  return (
    <div className="mt-4">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search…"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => search(true)}
          className="text-sm underline"
        >
          Search
        </button>
      </div>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            <span>{item.label}</span>
            <button
              type="button"
              onClick={() => pullIntoLibrary(libraryCollectionPath, kind, item)}
              className="text-xs text-blue-600 underline"
            >
              Add to my library
            </button>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => search(false)}
          className="mt-2 text-sm underline"
        >
          Load more
        </button>
      )}
    </div>
  );
}
