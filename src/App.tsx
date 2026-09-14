import { useEffect } from "react";
import { ensureUserDoc } from "./auth/ensureUserDoc";
import { SignIn } from "./auth/SignIn";
import { useAuth } from "./auth/useAuth";

export function App() {
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (user) void ensureUserDoc(user);
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
    </div>
  );
}
