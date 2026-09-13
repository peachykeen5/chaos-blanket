export const userDocPath = (uid: string) => `users/${uid}`;

export const stitchLibraryCollectionPath = (uid: string) =>
  `users/${uid}/stitchLibrary`;

export const colourLibraryCollectionPath = (uid: string) =>
  `users/${uid}/colourLibrary`;

export const projectsCollectionPath = (uid: string) => `users/${uid}/projects`;

export const projectDocPath = (uid: string, projectId: string) =>
  `users/${uid}/projects/${projectId}`;

export const projectStitchesCollectionPath = (uid: string, projectId: string) =>
  `${projectDocPath(uid, projectId)}/stitches`;

export const projectColoursCollectionPath = (uid: string, projectId: string) =>
  `${projectDocPath(uid, projectId)}/colours`;

export const projectHistoryCollectionPath = (uid: string, projectId: string) =>
  `${projectDocPath(uid, projectId)}/history`;

export const globalStitchesCollectionPath = () => "globalStitches";

export const globalColoursCollectionPath = () => "globalColours";

export const rateLimitDocPath = (uid: string) => `users/${uid}/meta/rateLimit`;
