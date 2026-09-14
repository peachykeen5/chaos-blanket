import { signInAnonymously, signOut } from "firebase/auth";
import { afterEach, describe, expect, it } from "vitest";
import { auth } from "./firebase";
import {
  bulkAddLabels,
  deleteItem,
  fetchLabeledItems,
  updateColourHex,
} from "./lists";

interface Item {
  id: string;
  label: string;
  hex?: string;
}

afterEach(async () => {
  await signOut(auth);
});

describe("lists", () => {
  it("bulk-adds only labels not already in the list, and fetch reflects them", async () => {
    const { user } = await signInAnonymously(auth);
    const collectionPath = `users/${user.uid}/projects/p1/colours`;

    const firstAdded = await bulkAddLabels(collectionPath, "Red\nBlue", []);
    expect(firstAdded).toBe(2);

    const secondAdded = await bulkAddLabels(
      collectionPath,
      "red\nGreen",
      ["Red", "Blue"]
    );
    expect(secondAdded).toBe(1); // "red" skipped as a duplicate of "Red"

    const items = await fetchLabeledItems<Item>(collectionPath);
    expect(items.map((i) => i.label).sort()).toEqual(["Blue", "Green", "Red"]);
  });

  it("deletes an item and updates a colour's hex", async () => {
    const { user } = await signInAnonymously(auth);
    const collectionPath = `users/${user.uid}/projects/p1/colours`;

    await bulkAddLabels(collectionPath, "Coral", []);
    const [item] = await fetchLabeledItems<Item>(collectionPath);

    await updateColourHex(collectionPath, item.id, "#FF7F50");
    const [updated] = await fetchLabeledItems<Item>(collectionPath);
    expect(updated.hex).toBe("#FF7F50");

    await deleteItem(collectionPath, item.id);
    expect(await fetchLabeledItems<Item>(collectionPath)).toEqual([]);
  });
});
