import { useAuth } from "./useAuth";

export function SignIn() {
  const { error, signIn } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-8">
      <h1 className="text-2xl font-bold text-gray-900">Chaos Blanket</h1>
      <button
        type="button"
        onClick={signIn}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Sign in with Google
      </button>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}{" "}
          <button type="button" onClick={signIn} className="underline">
            Retry
          </button>
        </p>
      )}
    </div>
  );
}
