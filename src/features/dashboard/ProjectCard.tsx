import { useState } from "react";
import { Link } from "react-router";
import { ConfirmModal } from "../../components";
import { RulerIcon, TrashIcon, YarnIcon } from "../../components/icons";
import type { ProjectCardData } from "./theme";
import { themeColourForId } from "./theme";

interface ProjectCardProps {
  project: ProjectCardData;
  onDelete: (id: string) => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const headerColour = project.lastColourHex ?? themeColourForId(project.id);

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div
        className="relative flex h-[110px] items-end p-4"
        style={{ backgroundColor: headerColour }}
      >
        <div
          className="absolute inset-x-0 top-0 h-10 opacity-[0.15]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, white 0 6px, transparent 6px 10px)",
            backgroundSize: "16px 6px",
            backgroundRepeat: "repeat",
          }}
        />
        <span className="rounded-full bg-black/20 px-3 py-1 text-xs font-semibold text-white">
          {project.lastStitchLabel}
        </span>
      </div>

      <div className="p-4">
        <h3 className="font-bold text-[#130E26]">{project.name}</h3>
        <p className="mt-0.5 text-sm text-[#726E8D]">{project.lastEditedLabel}</p>

        <div className="mt-3 flex items-center gap-4 border-b border-[#EEEAFF] pb-3 text-sm text-[#726E8D]">
          <span className="flex items-center gap-1.5">
            <RulerIcon className="h-4 w-4" />
            {project.rowsCompleted} rows
          </span>
          <span className="flex items-center gap-1.5">
            <YarnIcon className="h-4 w-4" />
            {project.yarnCount} yarns
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <Link
            to={`/projects/${project.id}`}
            className="rounded-lg bg-[#EEEAFF] px-3 py-1.5 text-sm font-semibold text-[#B0176C] hover:bg-[#E4DDFF]"
          >
            Continue Design
          </Link>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="text-[#726E8D] hover:text-[#E0125C]"
            aria-label={`Delete ${project.name}`}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirmingDelete}
        title="Delete this project?"
        message={`This will permanently delete "${project.name}" and all of its history. This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmingDelete(false);
          onDelete(project.id);
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
