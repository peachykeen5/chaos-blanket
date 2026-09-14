import { vi } from "vitest";

// Mock Firebase modules for unit tests (non-emulator tests)
// These mocks are sufficient for testing pure functions like isValidRowRange
// Emulator tests use the real Firebase SDK with firebase emulators:exec
vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(),
  connectAuthEmulator: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(),
}));

vi.mock("firebase/functions", () => ({
  getFunctions: vi.fn(),
  connectFunctionsEmulator: vi.fn(),
}));

vi.mock("firebase/app-check", () => ({
  initializeAppCheck: vi.fn(),
  ReCaptchaV3Provider: vi.fn(),
}));
