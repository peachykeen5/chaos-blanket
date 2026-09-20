import { signInAnonymously, signOut } from "firebase/auth";
import { afterEach, describe, expect, it } from "vitest";
import { auth } from "../../lib/firebase";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  renameProject,
  updateRowRange,
} from "./projectsApi";

afterEach(async () => {
  await signOut(auth);
});

describe("projectsApi", () => {
  it("creates, lists, renames, updates the row range of, and deletes a project", async () => {
    const { user } = await signInAnonymously(auth);

    const projectId = await createProject(user.uid, {
      name: "Blanket 1",
      rowMin: 2,
      rowMax: 6,
    });

    let projects = await listProjects(user.uid);
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ name: "Blanket 1", rowMin: 2, rowMax: 6 });

    await renameProject(user.uid, projectId, "Renamed Blanket");
    await updateRowRange(user.uid, projectId, 3, 3);
    projects = await listProjects(user.uid);
    expect(projects[0]).toMatchObject({
      name: "Renamed Blanket",
      rowMin: 3,
      rowMax: 3,
    });

    await deleteProject(user.uid, projectId);
    expect(await listProjects(user.uid)).toEqual([]);
  });

  it("rejects creating a project with an invalid row range", async () => {
    const { user } = await signInAnonymously(auth);
    await expect(
      createProject(user.uid, { name: "Bad", rowMin: 6, rowMax: 2 })
    ).rejects.toThrow();
  });

  it("getProject returns the project by id, or null if it doesn't exist", async () => {
    const { user } = await signInAnonymously(auth);
    const projectId = await createProject(user.uid, {
      name: "Fetchable",
      rowMin: 1,
      rowMax: 4,
    });

    const found = await getProject(user.uid, projectId);
    expect(found).toMatchObject({
      id: projectId,
      name: "Fetchable",
      rowMin: 1,
      rowMax: 4,
    });

    expect(await getProject(user.uid, "does-not-exist")).toBeNull();
  });
});
