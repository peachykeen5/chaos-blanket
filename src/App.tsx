import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, Route, Routes } from "react-router";
import { ensureUserDoc } from "./auth/ensureUserDoc";
import { SignIn } from "./auth/SignIn";
import { useAuth } from "./auth/useAuth";
import { Button, Heading, InlineError } from "./components";
import { Dashboard } from "./features/dashboard/Dashboard";
import { ProjectPage } from "./features/projects/ProjectPage";
import { SettingsPage } from "./features/projects/SettingsPage";

interface ProjectShellProps {
  children: ReactNode;
  displayName: string;
  onSignOut: () => void;
  bootstrapError: string | null;
}

function ProjectShell({ children, displayName, onSignOut, bootstrapError }: ProjectShellProps) {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="flex items-center justify-between">
        <Link to="/">
          <Heading level={1}>Chaos Blanket</Heading>
        </Link>
        <Button variant="link" size="md" onClick={onSignOut}>
          Sign out
        </Button>
      </div>
      <p className="mt-4 text-sm text-gray-500">Signed in as {displayName}</p>
      {bootstrapError && <InlineError className="mt-2">{bootstrapError}</InlineError>}
      {children}
    </div>
  );
}

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
          <ProjectShell displayName={displayName} onSignOut={signOut} bootstrapError={bootstrapError}>
            <ProjectPage uid={user.uid} />
          </ProjectShell>
        }
      />
      <Route
        path="/projects/:projectId/settings"
        element={
          <ProjectShell displayName={displayName} onSignOut={signOut} bootstrapError={bootstrapError}>
            <SettingsPage uid={user.uid} />
          </ProjectShell>
        }
      />
    </Routes>
  );
}
