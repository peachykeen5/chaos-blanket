import { useEffect, useState } from "react";
import { Route, Routes } from "react-router";
import { ensureUserDoc } from "./auth/ensureUserDoc";
import { SignIn } from "./auth/SignIn";
import { useAuth } from "./auth/useAuth";
import { Dashboard } from "./features/dashboard/Dashboard";
import { ProjectPage } from "./features/projects/ProjectPage";
import { SettingsPage } from "./features/projects/SettingsPage";

export function App() {
  const { user, loading, signOut } = useAuth();
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

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

  const displayName = user.displayName ?? user.email ?? "";

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Dashboard
            uid={user.uid}
            displayName={displayName}
            onSignOut={signOut}
            bootstrapError={bootstrapError}
          />
        }
      />
      <Route
        path="/projects/:projectId"
        element={
          <ProjectPage
            uid={user.uid}
            displayName={displayName}
            onSignOut={signOut}
            bootstrapError={bootstrapError}
          />
        }
      />
      <Route
        path="/projects/:projectId/settings"
        element={
          <SettingsPage
            uid={user.uid}
            displayName={displayName}
            onSignOut={signOut}
            bootstrapError={bootstrapError}
          />
        }
      />
    </Routes>
  );
}
