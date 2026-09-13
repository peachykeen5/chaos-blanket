import { describe, expect, it } from "vitest";
import {
  colourLibraryCollectionPath,
  globalColoursCollectionPath,
  globalStitchesCollectionPath,
  projectColoursCollectionPath,
  projectDocPath,
  projectHistoryCollectionPath,
  projectStitchesCollectionPath,
  projectsCollectionPath,
  rateLimitDocPath,
  stitchLibraryCollectionPath,
  userDocPath,
} from "./paths";

describe("paths", () => {
  it("builds every path from a uid and, where needed, a projectId", () => {
    expect(userDocPath("u1")).toBe("users/u1");
    expect(stitchLibraryCollectionPath("u1")).toBe("users/u1/stitchLibrary");
    expect(colourLibraryCollectionPath("u1")).toBe("users/u1/colourLibrary");
    expect(projectsCollectionPath("u1")).toBe("users/u1/projects");
    expect(projectDocPath("u1", "p1")).toBe("users/u1/projects/p1");
    expect(projectStitchesCollectionPath("u1", "p1")).toBe(
      "users/u1/projects/p1/stitches"
    );
    expect(projectColoursCollectionPath("u1", "p1")).toBe(
      "users/u1/projects/p1/colours"
    );
    expect(projectHistoryCollectionPath("u1", "p1")).toBe(
      "users/u1/projects/p1/history"
    );
    expect(globalStitchesCollectionPath()).toBe("globalStitches");
    expect(globalColoursCollectionPath()).toBe("globalColours");
    expect(rateLimitDocPath("u1")).toBe("users/u1/meta/rateLimit");
  });
});
