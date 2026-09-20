import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ChaosBlanketMark, InlineError } from "../../components";
import {
  ArrowLeftIcon,
  CheckIcon,
  LogOutIcon,
  PlusIcon,
} from "../../components/icons";
import { dedupeAgainstExisting } from "../../lib/bulkPaste";
import { contributeItem } from "../../lib/contribute";
import {
  addLabeledItemWithHex,
  deleteItem,
  fetchLabeledItems,
  syncLabeledItems,
  updateColourHex,
} from "../../lib/lists";
import { normalizeLabel } from "../../lib/normalize";
import {
  colourLibraryCollectionPath,
  projectColoursCollectionPath,
  projectStitchesCollectionPath,
  stitchLibraryCollectionPath,
} from "../../lib/paths";
import type { ColourItem, Project, StitchItem } from "../../types";
import { getProject, isValidRowRange, renameProject, updateRowRange } from "./projectsApi";

interface StagedColour {
  label: string;
  hex?: string;
}

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

interface SettingsPageProps {
  uid: string;
  displayName: string;
  onSignOut: () => void;
  bootstrapError: string | null;
}

export function SettingsPage({
  uid,
  displayName,
  onSignOut,
  bootstrapError,
}: SettingsPageProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [rowMin, setRowMin] = useState(2);
  const [rowMax, setRowMax] = useState(6);
  const [stitchesText, setStitchesText] = useState("");
  const [colours, setColours] = useState<StagedColour[]>([]);
  const [libraryStitches, setLibraryStitches] = useState<StitchItem[]>([]);
  const [originalStitches, setOriginalStitches] = useState<StitchItem[]>([]);
  const [originalColours, setOriginalColours] = useState<ColourItem[]>([]);
  const [libraryColourLabels, setLibraryColourLabels] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [found, stitches, colourItems, libStitches, libColours] = await Promise.all([
        getProject(uid, projectId!),
        fetchLabeledItems<StitchItem>(projectStitchesCollectionPath(uid, projectId!)),
        fetchLabeledItems<ColourItem>(projectColoursCollectionPath(uid, projectId!)),
        fetchLabeledItems<StitchItem>(stitchLibraryCollectionPath(uid)),
        fetchLabeledItems<ColourItem>(colourLibraryCollectionPath(uid)),
      ]);
      if (cancelled) return;
      setProject(found);
      if (found) {
        setName(found.name);
        setRowMin(found.rowMin);
        setRowMax(found.rowMax);
      }
      setOriginalStitches(stitches);
      setStitchesText(stitches.map((s) => s.label).join("\n"));
      setOriginalColours(colourItems);
      setColours(colourItems.map((c) => ({ label: c.label, hex: c.hex })));
      setLibraryStitches(libStitches);
      setLibraryColourLabels(libColours.map((c) => c.label));
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [uid, projectId]);

  const stagedStitchLabels = new Set(
    stitchesText
      .split("\n")
      .map((l) => normalizeLabel(l.trim()))
      .filter(Boolean)
  );

  function addStitchFromLibrary(label: string) {
    const lines = stitchesText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.some((l) => normalizeLabel(l) === normalizeLabel(label))) return;
    setStitchesText(lines.length > 0 ? `${stitchesText.trimEnd()}\n${label}` : label);
  }

  function updateColourLabel(index: number, label: string) {
    setColours((prev) => prev.map((c, i) => (i === index ? { ...c, label } : c)));
  }

  function updateColourHexAt(index: number, hex: string) {
    setColours((prev) => prev.map((c, i) => (i === index ? { ...c, hex } : c)));
  }

  function removeColourRow(index: number) {
    setColours((prev) => prev.filter((_, i) => i !== index));
  }

  function addColourRow() {
    setColours((prev) => [...prev, { label: "" }]);
  }

  async function handleSave() {
    if (!projectId) return;
    if (!isValidRowRange(rowMin, rowMax)) {
      setError("Row min must be a whole number no greater than row max.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const trimmedName = name.trim();
      if (trimmedName && trimmedName !== "") {
        await renameProject(uid, projectId, trimmedName);
      }
      await updateRowRange(uid, projectId, rowMin, rowMax);

      const { addedLabels: newStitchLabels } = await syncLabeledItems(
        projectStitchesCollectionPath(uid, projectId),
        stitchesText,
        originalStitches
      );

      // Colours: structured per-row sync (add/update/remove), since colours
      // carry an optional hex that a plain label-diff can't express.
      const stagedColours = colours
        .map((c) => ({ label: c.label.trim(), hex: c.hex }))
        .filter((c) => c.label.length > 0);

      const coloursCollectionPath = projectColoursCollectionPath(uid, projectId);
      const newColourLabels: string[] = [];

      for (const staged of stagedColours) {
        const existing = originalColours.find(
          (item) => normalizeLabel(item.label) === normalizeLabel(staged.label)
        );
        if (existing) {
          if (staged.hex && staged.hex !== existing.hex) {
            await updateColourHex(coloursCollectionPath, existing.id, staged.hex);
          }
        } else {
          await addLabeledItemWithHex(
            coloursCollectionPath,
            { label: staged.label, hex: staged.hex },
            originalColours.map((c) => c.label)
          );
          newColourLabels.push(staged.label);
        }
      }
      for (const existing of originalColours) {
        const stillStaged = stagedColours.some(
          (c) => normalizeLabel(c.label) === normalizeLabel(existing.label)
        );
        if (!stillStaged) {
          await deleteItem(coloursCollectionPath, existing.id);
        }
      }

      // Upsert genuinely-new-to-the-account-library stitches, then fire the
      // background Global Pool contribution for each (Stitches only —
      // matches the existing, unchanged contribution scope).
      const existingLibraryStitchLabels = libraryStitches.map((s) => s.label);
      const newToLibrary = dedupeAgainstExisting(newStitchLabels, existingLibraryStitchLabels);
      await Promise.all(
        newToLibrary.map((label) =>
          addLabeledItemWithHex(stitchLibraryCollectionPath(uid), { label }, existingLibraryStitchLabels)
        )
      );
      newToLibrary.forEach((label) => void contributeItem(label));

      // Colours: upsert new-to-library colours (with hex), no contribution —
      // the Global Pool is Stitches-only.
      const newColourLabelsToLibrary = dedupeAgainstExisting(newColourLabels, libraryColourLabels);
      await Promise.all(
        newColourLabelsToLibrary.map((label) => {
          const staged = stagedColours.find(
            (c) => normalizeLabel(c.label) === normalizeLabel(label)
          );
          return addLabeledItemWithHex(
            colourLibraryCollectionPath(uid),
            { label, hex: staged?.hex },
            libraryColourLabels
          );
        })
      );

      navigate(`/projects/${projectId}`);
    } catch {
      setError("Couldn't save your settings — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!projectId) return null;

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

        {loading ? (
          <p className="mt-8 text-sm text-[#726E8D]">Loading…</p>
        ) : !project ? (
          <p className="mt-8 text-sm text-[#726E8D]">Project not found.</p>
        ) : (
          <>
            <Link
              to={`/projects/${projectId}`}
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#B0176C] hover:text-[#93125A]"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to {project.name}
            </Link>

            <h1 className="mt-2 text-3xl font-extrabold text-[#B0176C]">Settings</h1>
            <p className="text-sm text-[#726E8D]">Project: {project.name}</p>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="rounded-3xl bg-white p-8 shadow-sm lg:col-span-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#130E26]">Project name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-[#EAE6FA] px-4 py-3 text-sm text-[#130E26] focus:border-[#B0176C] focus:outline-none"
                  />
                </label>

                <div className="mt-6">
                  <span className="text-sm font-semibold text-[#130E26]">
                    Row Generation Range
                  </span>
                  <div className="mt-2 flex items-center gap-8">
                    <label className="text-sm text-[#726E8D]">
                      Row min
                      <input
                        type="number"
                        value={rowMin}
                        onChange={(e) => setRowMin(Number(e.target.value))}
                        className="mt-1 block w-16 rounded-lg border border-[#EAE6FA] px-2 py-2 text-center text-sm text-[#130E26] focus:border-[#B0176C] focus:outline-none"
                      />
                    </label>
                    <label className="text-sm text-[#726E8D]">
                      Row max
                      <input
                        type="number"
                        value={rowMax}
                        onChange={(e) => setRowMax(Number(e.target.value))}
                        className="mt-1 block w-16 rounded-lg border border-[#EAE6FA] px-2 py-2 text-center text-sm text-[#130E26] focus:border-[#B0176C] focus:outline-none"
                      />
                    </label>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#130E26]">Stitches</span>
                    <span className="text-xs text-[#A39EB9]">Paste one per line</span>
                  </div>
                  <textarea
                    rows={5}
                    value={stitchesText}
                    onChange={(e) => setStitchesText(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-[#EAE6FA] px-4 py-3 text-sm text-[#130E26] focus:border-[#B0176C] focus:outline-none"
                  />
                </div>

                <div className="mt-6">
                  <span className="text-sm font-semibold text-[#130E26]">Colours</span>
                  <div className="mt-2 flex flex-col gap-2">
                    {colours.map((colour, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          placeholder="Colour name"
                          value={colour.label}
                          onChange={(e) => updateColourLabel(index, e.target.value)}
                          className="flex-1 rounded-lg border border-[#EAE6FA] px-3 py-2 text-sm text-[#130E26] focus:border-[#B0176C] focus:outline-none"
                        />
                        <input
                          type="color"
                          title="Pick a colour"
                          value={HEX_PATTERN.test(colour.hex ?? "") ? colour.hex! : "#ffffff"}
                          onChange={(e) => updateColourHexAt(index, e.target.value)}
                          className="h-[31px] w-[31px] shrink-0 rounded-lg border border-[#EAE6FA] p-0.5"
                        />
                        <input
                          placeholder="#HEX"
                          value={colour.hex ?? ""}
                          onChange={(e) => updateColourHexAt(index, e.target.value)}
                          className="w-28 shrink-0 rounded-lg border border-[#EAE6FA] px-3 py-2 text-sm uppercase text-[#130E26] focus:border-[#B0176C] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeColourRow(index)}
                          className="shrink-0 text-sm font-semibold text-[#E60E12] hover:text-[#B00]"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addColourRow}
                    className="mt-3 text-sm font-semibold text-[#B0176C] hover:text-[#93125A]"
                  >
                    + Add colour
                  </button>
                </div>

                {error && <InlineError className="mt-4">{error}</InlineError>}

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="mt-6 rounded-full bg-gradient-to-r from-[#F36D00] to-[#B0176C] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save Settings"}
                </button>
              </div>

              <div className="rounded-3xl border border-[#EAE6FA] bg-[#E0125C]/[0.07] p-6 shadow-sm">
                <h2 className="text-lg font-extrabold text-[#B0176C]">Add from your library</h2>
                {libraryStitches.length === 0 ? (
                  <p className="mt-4 text-sm text-[#726E8D]">Nothing in your library yet.</p>
                ) : (
                  <ul className="mt-4 flex flex-col gap-3">
                    {libraryStitches.map((item) => {
                      const added = stagedStitchLabels.has(normalizeLabel(item.label));
                      return (
                        <li key={item.id} className="flex items-center justify-between gap-2">
                          <span
                            className={
                              added
                                ? "text-sm text-[#A39EB9]"
                                : "text-sm font-semibold text-[#130E26]"
                            }
                          >
                            {item.label}
                          </span>
                          {added ? (
                            <span className="flex shrink-0 items-center gap-1 rounded-md bg-[#EEEAFF] px-2.5 py-1 text-xs font-semibold text-[#B0176C]">
                              <CheckIcon className="h-3 w-3" />
                              Added
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => addStitchFromLibrary(item.label)}
                              aria-label={`Add ${item.label}`}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F36D00] text-white hover:opacity-90"
                            >
                              <PlusIcon className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
