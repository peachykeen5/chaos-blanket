import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ChaosBlanketMark, InlineError } from "../../components";
import { createProject, deleteProject } from "../projects/projectsApi";
import { loadDashboardData } from "./dashboardApi";
import {
  PlusIcon,
  SmileIcon,
  SparklesIcon,
  TrendingUpIcon,
} from "../../components/icons";
import { ProjectCard } from "./ProjectCard";
import type { DashboardSummary, ProjectCardData } from "./theme";

const DEFAULT_ROW_MIN = 2;
const DEFAULT_ROW_MAX = 6;

interface DashboardProps {
  uid: string;
  displayName: string;
  onSignOut: () => void;
  bootstrapError: string | null;
}

export function Dashboard({ uid, displayName, onSignOut, bootstrapError }: DashboardProps) {
  const navigate = useNavigate();
  const [cards, setCards] = useState<ProjectCardData[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function reload() {
    try {
      const data = await loadDashboardData(uid);
      setCards(data.cards);
      setSummary(data.summary);
      setLoadError(null);
    } catch {
      setLoadError("Couldn't load your projects — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  async function handleCreate() {
    setActionError(null);
    try {
      const projectId = await createProject(uid, {
        name: "Untitled Project",
        rowMin: DEFAULT_ROW_MIN,
        rowMax: DEFAULT_ROW_MAX,
      });
      navigate(`/projects/${projectId}/settings`);
    } catch {
      setActionError("Couldn't start a new project — check your connection and try again.");
    }
  }

  async function handleDelete(id: string) {
    setActionError(null);
    try {
      await deleteProject(uid, id);
      setCards((current) => current.filter((card) => card.id !== id));
      setSummary((current) =>
        current ? { ...current, activeProjects: current.activeProjects - 1 } : current
      );
    } catch {
      setActionError("Couldn't delete that project — check your connection and try again.");
    }
  }

  return (
    <div className="min-h-screen bg-[#EEEAFF] px-6 py-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ChaosBlanketMark />
            <div>
              <div className="text-2xl font-extrabold text-[#B0176C]">Crochet Chaos</div>
              <div className="flex items-center gap-2 text-sm text-[#726E8D]">
                <span>Signed in as {displayName}</span>
                <span aria-hidden="true">·</span>
                <button type="button" onClick={onSignOut} className="underline hover:text-[#130E26]">
                  Sign out
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreate}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#F36D00] to-[#B0176C] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            <PlusIcon className="h-4 w-4" />
            Start a new project
          </button>
        </div>

        {actionError && <InlineError className="mt-3">{actionError}</InlineError>}
        {loadError && <InlineError className="mt-3">{loadError}</InlineError>}
        {bootstrapError && <InlineError className="mt-3">{bootstrapError}</InlineError>}

        <div className="mt-6 grid grid-cols-1 gap-6 rounded-2xl bg-white p-6 shadow-sm sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F36D00]/[0.07] text-[#F36D00]">
              <SparklesIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-[#A39EB9]">
                Active Projects
              </div>
              <div className="font-bold text-[#130E26]">
                {summary ? summary.activeProjects : "–"} Projects
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#B0176C]/[0.07] text-[#B0176C]">
              <TrendingUpIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-[#A39EB9]">
                Stitches Generated
              </div>
              <div className="font-bold text-[#130E26]">
                {summary ? summary.stitchesGenerated.toLocaleString() : "–"} randomized stitches
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#3DC1D3]/[0.07] text-[#3DC1D3]">
              <SmileIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-[#A39EB9]">
                Happy Accidents
              </div>
              <div className="font-bold text-[#130E26]">
                {summary ? summary.happyAccidents : "–"} happy accidents
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-[#130E26]">My Projects</h1>
            <span className="rounded-full bg-[#B0176C] px-3 py-1 text-xs font-semibold text-white">
              {cards.length} Active
            </span>
          </div>
          {/* Archive feature not built yet — Project schema already carries
              archived/archivedAt so this can be wired up without a migration.
              Re-add `ArrowRightIcon` to the import above when restoring this.
          <span className="flex items-center gap-1 text-sm font-semibold text-[#B0176C]">
            View Archive
            <ArrowRightIcon className="h-4 w-4" />
          </span>
          */}
        </div>

        <div className="mt-4 rounded-2xl bg-white p-6 shadow-sm">
          {loading ? (
            <p className="text-sm text-[#726E8D]">Loading your projects…</p>
          ) : cards.length === 0 ? (
            <p className="text-sm text-[#726E8D]">
              No active projects yet. Start a new project to get going.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card) => (
                <ProjectCard key={card.id} project={card} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
