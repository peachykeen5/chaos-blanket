# Chaos Blanket Generator

A web app for crocheters making a "chaos blanket": a blanket whose stitch,
colour, and length per stretch are chosen randomly per project rather than
planned in advance.

## Language

### Generation & the blanket

**Segment**:
The result of one Generate action: a stitch, a colour, and a Row Count,
meaning "work this many rows in this stitch and colour." Two consecutive
Segments may carry identical stitch/colour/count values by chance — these
are never merged; every Generate produces its own Segment.
_Avoid_: Row (a Segment is a run of rows, not a single row), History Entry, block

**Row Range**:
A Project's configured `[rowMin, rowMax]` bounds — the inclusive range a
Segment's Row Count is drawn from.
_Avoid_: Row count range

**Row Count**:
The number of rows a single Segment's stitch/colour combination is worked
for, randomly chosen within the Project's Row Range at Generate time.

**Generate**:
The action of randomly producing one Segment for a Project: one Stitch
from its Project List, one Colour from its Project List, and a Row Count
from its Row Range. Always writes the resulting Segment to History
immediately — there is no save/skip/preview step.

**History**:
A Project's ordered record of every Segment it has ever generated, newest
first, individually deletable. Each entry stores its stitch/colour by
label (and hex, for colours) at the time it was generated — it is a
snapshot, not a reference, so editing or removing an Item later doesn't
change past History.

### Items and their pools

**Item**:
The umbrella term for a Stitch or a Colour — a named thing a Project draws
from when generating. Always identified by its Label; a Colour may
additionally carry a Hex value.
_Avoid_: Entry (reserved for History), Pool Item

**Stitch**:
A named crochet technique or pattern (e.g. "double crochet"), identified
solely by its Label. No structured stitch data (chart notation, symbol,
yarn weight) — just the name a user typed.

**Colour**:
A named yarn colour, identified by its Label and, optionally, a Hex code.
A Colour without a Hex is just a name; the Hex is never required.

**Project List**:
The set of Stitches (or Colours) belonging to one Project — what Generate
actually draws from. Distinct from the Account Library and the Global
Pool: copying an Item between any of the three always duplicates it into
a new document, never links to a shared one.
_Avoid_: Project pool

**Account Library**:
A signed-in user's personal, cross-project collection of saved Stitches
and Colours, reusable across any of their Projects.
_Avoid_: Library (ambiguous with Global Pool), Saved items

**Global Pool**:
The public, deduplicated collection of Stitches and Colours contributed by
all users, browsable read-only by any signed-in user and never directly
writable by a client.
_Avoid_: Library, Global library, Shared pool

### Contribution & abuse prevention

**Contribution**:
The act of writing an Item into the Global Pool, via the `contributeToGlobal`
function. Fires only at two points: saving an Item to the Account Library,
or pulling an Item from the Global Pool into the Account Library. Editing
an Item afterward (e.g. adding a Hex to a Colour) never re-fires it.
_Avoid_: Contribute, Publish, Submit

**Global Key**:
The deterministic Global Pool document ID derived from an Item being
contributed: a normalized form of the Label (lowercased, trimmed,
punctuation-stripped), or the Hex code for a Colour when one is present.
Two Contributions that resolve to the same Global Key are the same Global
Pool entry; the first contributor's Label wins.
_Avoid_: Normalized ID, Dedup key

**Contributor Count**:
Internal bookkeeping on a Global Pool entry counting how many times it's
been contributed (directly or independently re-derived by another user).
Never attributed to a specific user in the UI; reserved for future
"popular" sorting.

**Rate Limit**:
A per-user cap (~20/day) on Contributions, tracked per calendar day (UTC).
Exceeding it silently fails the background Contribution without affecting
the Project List / Account Library write that triggered it.

**Denylist**:
A fixed, hardcoded list of disallowed terms `contributeToGlobal` checks a
Label against before allowing a Contribution.
