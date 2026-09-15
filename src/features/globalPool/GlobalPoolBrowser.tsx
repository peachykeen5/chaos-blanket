import type { QueryDocumentSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { GlobalItemDoc } from "../../types";
import {
  PAGE_SIZE,
  fetchGlobalPoolPage,
  pullIntoLibrary,
} from "./globalPoolApi";

interface GlobalPoolBrowserProps {
  globalCollectionPath: string;
  libraryCollectionPath: string;
  onCrossPanelChange: () => void;
}

export function GlobalPoolBrowser({
  globalCollectionPath,
  libraryCollectionPath,
  onCrossPanelChange,
}: GlobalPoolBrowserProps) {
  const [prefix, setPrefix] = useState("");
  const [items, setItems] = useState<GlobalItemDoc[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSucceededId, setJustSucceededId] = useState<string | null>(null);

  async function search(reset: boolean) {
    setError(null);
    setLoading(true);
    try {
      const page = await fetchGlobalPoolPage(globalCollectionPath, {
        prefix: prefix || undefined,
        after: reset ? null : lastDoc,
      });
      setItems(reset ? page.items : [...items, ...page.items]);
      setLastDoc(page.lastDoc);
      setHasMore(page.items.length === PAGE_SIZE);
    } catch {
      setError("Couldn't load the global pool — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // Load the first alphabetical page on mount, mirroring the load-on-mount
  // pattern used elsewhere (e.g. ProjectsPanel's `reload`).
  useEffect(() => {
    void search(true);
  }, []);

  async function handlePullIntoLibrary(item: GlobalItemDoc) {
    setError(null);
    setLoading(true);
    try {
      await pullIntoLibrary(libraryCollectionPath, item);
      onCrossPanelChange();
      setJustSucceededId(item.id);
      setTimeout(() => setJustSucceededId(null), 2000);
    } catch {
      setError("Couldn't add that to your library — check your connection and try again.");
    } finally {
      setLoading(false);
    }
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
          disabled={loading}
          className="text-sm underline"
        >
          Search
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            <span>{item.label}</span>
            <button
              type="button"
              onClick={() => handlePullIntoLibrary(item)}
              disabled={loading}
              className="text-xs text-blue-600 underline"
            >
              Add to my library
            </button>
            {justSucceededId === item.id && (
              <span className="ml-1 text-xs text-green-600">Added ✓</span>
            )}
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => search(false)}
          disabled={loading}
          className="mt-2 text-sm underline"
        >
          Load more
        </button>
      )}
    </div>
  );
}
