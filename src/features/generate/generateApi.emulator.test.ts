import { signInAnonymously, signOut } from "firebase/auth";
import { afterEach, describe, expect, it } from "vitest";
import { auth } from "../../lib/firebase";
import { bulkAddLabels } from "../../lib/lists";
import {
  projectColoursCollectionPath,
  projectStitchesCollectionPath,
} from "../../lib/paths";
import type { Project } from "../../types";
import { fetchHistory, generateSegment } from "./generateApi";

afterEach(async () => {
  await signOut(auth);
});

function makeProject(id: string, rowMin: number, rowMax: number): Project {
  return { id, name: "Test", rowMin, rowMax, createdAt: null, updatedAt: null };
}

describe("generateSegment", () => {
  it("writes a history entry using the project's only stitch and colour, with rowCount in range", async () => {
    const { user } = await signInAnonymously(auth);
    const project = makeProject("p1", 2, 4);
    await bulkAddLabels(
      projectStitchesCollectionPath(user.uid, project.id),
      "Double Crochet",
      []
    );
    await bulkAddLabels(
      projectColoursCollectionPath(user.uid, project.id),
      "Coral",
      []
    );

    await generateSegment(user.uid, project);

    const history = await fetchHistory(user.uid, project.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      stitchLabel: "Double Crochet",
      colourLabel: "Coral",
    });
    expect(history[0].rowCount).toBeGreaterThanOrEqual(2);
    expect(history[0].rowCount).toBeLessThanOrEqual(4);
  });

  it("never merges consecutive generates, even when they land on identical values", async () => {
    const { user } = await signInAnonymously(auth);
    const project = makeProject("p2", 3, 3); // fixed row count forces identical Segments
    await bulkAddLabels(
      projectStitchesCollectionPath(user.uid, project.id),
      "Moss Stitch",
      []
    );
    await bulkAddLabels(
      projectColoursCollectionPath(user.uid, project.id),
      "Red",
      []
    );

    await generateSegment(user.uid, project);
    await generateSegment(user.uid, project);

    const history = await fetchHistory(user.uid, project.id);
    expect(history).toHaveLength(2);
  });

  it("throws if the project has no stitches or no colours", async () => {
    const { user } = await signInAnonymously(auth);
    const project = makeProject("p3", 1, 1);
    await expect(generateSegment(user.uid, project)).rejects.toThrow();
  });
});
