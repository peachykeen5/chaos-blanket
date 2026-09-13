# Global Pool identity is keyed by hex, not label+hex

The Global Pool needs a deterministic key so contributions can dedupe via
"does this doc ID already exist" rather than a query. We key a Colour's
[Global Key](../../CONTEXT.md) on its hex code alone when one is present
(falling back to the normalized label only when there's no hex), and a
Stitch's on its normalized label. The alternative was keying on
label+hex together.

We chose hex-alone because colour identity is fundamentally the hex value:
two different names for `#FF7F50` are the same colour, and merging them
under one Global Pool entry (first contributor's label wins) is more
useful than letting the pool fill with near-duplicate colours under
different names. The accepted cost is the reverse case — the same label
contributed with two different hex values becomes two separate Global
Pool entries that both display that label, which is intentional but easy
to mistake for a bug.

This is hard to reverse later without migrating every existing Global
Pool document to a new ID scheme.
