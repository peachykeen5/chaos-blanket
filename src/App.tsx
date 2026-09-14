import { useEffect, useState } from "react";
import { ensureUserDoc } from "./auth/ensureUserDoc";
import { SignIn } from "./auth/SignIn";
import { useAuth } from "./auth/useAuth";

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
    </div>
  );
}
