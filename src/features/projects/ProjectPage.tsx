import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { ChaosBlanketMark, InlineError } from "../../components";
import { LogOutIcon, SettingsIcon } from "../../components/icons";
import { fetchLabeledItems } from "../../lib/lists";
import { projectColoursCollectionPath, projectStitchesCollectionPath } from "../../lib/paths";
import type { Project } from "../../types";
import { GenerateAndHistoryPanel } from "../generate/GenerateAndHistoryPanel";
import { getProject, isValidRowRange } from "./projectsApi";

interface ProjectPageProps {
  uid: string;
  displayName: string;
  onSignOut: () => void;
  bootstrapError: string | null;
}

export function ProjectPage({ uid, displayName, onSignOut, bootstrapError }: ProjectPageProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [found, stitches, colours] = await Promise.all([
        getProject(uid, projectId!),
        fetchLabeledItems(projectStitchesCollectionPath(uid, projectId!)),
        fetchLabeledItems(projectColoursCollectionPath(uid, projectId!)),
      ]);
      if (cancelled) return;
      setProject(found);
      setIsConfigured(
        !!found &&
          stitches.length > 0 &&
          colours.length > 0 &&
          isValidRowRange(found.rowMin, found.rowMax)
      );
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [uid, projectId]);

  if (!projectId) return null;

  if (!loading && project && !isConfigured) {
    return <Navigate to={`/projects/${projectId}/settings`} replace />;
  }

  return (
    <div className="min-h-screen bg-[#EEEAFF] px-6 py-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ChaosBlanketMark />
            <div>
              <Link to="/" className="text-2xl font-extrabold text-[#B0176C]">
                Crochet Chaos
              </Link>
              <div className="text-sm text-[#726E8D]">Signed in as {displayName}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className="flex items-center gap-1.5 text-sm font-semibold text-[#B0176C] hover:text-[#93125A]"
          >
            <LogOutIcon className="h-4 w-4" />
            Sign out
          </button>
        </div>

        {bootstrapError && <InlineError className="mt-3">{bootstrapError}</InlineError>}

        {loading || !project ? (
          <p className="mt-8 text-sm text-[#726E8D]">
            {loading ? "Loading…" : "Project not found."}
          </p>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-3xl font-extrabold text-[#130E26]">{project.name}</h1>
              <Link
                to={`/projects/${projectId}/settings`}
                className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#B0176C] shadow-sm hover:bg-[#F5F2FF]"
              >
                <SettingsIcon className="h-4 w-4" />
                Settings
              </Link>
            </div>

            <GenerateAndHistoryPanel uid={uid} project={project} refreshKey={0} />
          </>
        )}
      </div>
    </div>
  );
}
