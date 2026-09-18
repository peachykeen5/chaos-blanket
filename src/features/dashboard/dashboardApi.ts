import type { Timestamp } from "firebase/firestore";
import { fetchLabeledItems } from "../../lib/lists";
import { projectColoursCollectionPath } from "../../lib/paths";
import type { ColourItem, Project } from "../../types";
import { fetchHistory } from "../generate/generateApi";
import { listProjects } from "../projects/projectsApi";
import { formatLastEdited } from "./formatLastEdited";
import { HAPPY_ACCIDENTS_PLACEHOLDER } from "./theme";
import type { DashboardSummary, ProjectCardData } from "./theme";

function toMillis(timestamp: Timestamp | null): number {
  return timestamp ? timestamp.toMillis() : 0;
}

async function loadProjectCard(uid: string, project: Project): Promise<ProjectCardData> {
  const [history, colours] = await Promise.all([
    fetchHistory(uid, project.id),
    fetchLabeledItems<ColourItem>(projectColoursCollectionPath(uid, project.id)),
  ]);

  const latest = history[0];
  const lastActivityMillis = Math.max(
    toMillis(project.updatedAt),
    latest ? toMillis(latest.generatedAt) : 0
  );

  return {
    id: project.id,
    name: project.name,
    lastEditedLabel: formatLastEdited(lastActivityMillis),
    rowsCompleted: history.reduce((sum, entry) => sum + entry.rowCount, 0),
    yarnCount: colours.length,
    lastStitchLabel: latest?.stitchLabel ?? "No stitches yet",
    lastColourHex: latest?.colourHex,
  };
}

export interface DashboardData {
  cards: ProjectCardData[];
  summary: DashboardSummary;
}

export async function loadDashboardData(uid: string): Promise<DashboardData> {
  const projects = await listProjects(uid);
  const cards = await Promise.all(projects.map((project) => loadProjectCard(uid, project)));

  return {
    cards,
    summary: {
      activeProjects: projects.length,
      stitchesGenerated: cards.reduce((sum, card) => sum + card.rowsCompleted, 0),
      happyAccidents: HAPPY_ACCIDENTS_PLACEHOLDER,
    },
  };
}
