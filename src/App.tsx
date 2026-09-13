import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth } from "./lib/firebase";

export function App() {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => onAuthStateChanged(auth, () => setAuthReady(true)), []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold text-gray-900">Chaos Blanket</h1>
      <p className="text-sm text-gray-500">
        {authReady ? "Auth connected" : "Connecting to auth…"}
      </p>
    </div>
  );
}
