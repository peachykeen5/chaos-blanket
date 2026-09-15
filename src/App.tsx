import { useCallback, useEffect, useState } from "react";
import { ensureUserDoc } from "./auth/ensureUserDoc";
import { SignIn } from "./auth/SignIn";
import { useAuth } from "./auth/useAuth";
import { GlobalPoolBrowser } from "./features/globalPool/GlobalPoolBrowser";
import { LibraryPanel } from "./features/library/LibraryPanel";
import { ProjectsPanel } from "./features/projects/ProjectsPanel";
import {
  globalStitchesCollectionPath,
  stitchLibraryCollectionPath,
} from "./lib/paths";

export function App() {
  const { user, loading, signOut } = useAuth();
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const bumpRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!user) return;
    ensureUserDoc(user).catch((err) => {
      console.error("ensureUserDoc failed", err);
      setBootstrapError("Couldn't set up your account. Try refreshing the page.");
    });
  }, [user]);

  if (loading) {
    return <div className="min-h-screen bg-gray-50 p-8">Loading…</div>;
  }

  if (!user) {
    return <SignIn />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Chaos Blanket</h1>
        <button
          type="button"
          onClick={signOut}
          className="text-sm text-gray-500 underline"
        >
          Sign out
        </button>
      </div>
      <p className="mt-4 text-sm text-gray-500">
        Signed in as {user.displayName ?? user.email}
      </p>
      {bootstrapError && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {bootstrapError}
        </p>
      )}
      <ProjectsPanel uid={user.uid} refreshKey={refreshKey} onCrossPanelChange={bumpRefresh} />
      <LibraryPanel uid={user.uid} refreshKey={refreshKey} onCrossPanelChange={bumpRefresh} />
      <div className="mt-6 border-t border-gray-200 pt-4">
        <h2 className="font-semibold text-gray-900">Browse global stitches</h2>
        <GlobalPoolBrowser
          globalCollectionPath={globalStitchesCollectionPath()}
          libraryCollectionPath={stitchLibraryCollectionPath(user.uid)}
          onCrossPanelChange={bumpRefresh}
        />
      </div>
    </div>
  );
}
