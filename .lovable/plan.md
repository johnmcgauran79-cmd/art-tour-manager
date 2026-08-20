# Initial WordPress Reconciliation on Tour Link

## Goal
When an admin links a system tour to a live website tour, immediately pull the website data, compare it field by field, and let the user choose — per field — whether ART wins (push to website) or the website wins (pull into ART). Same flow covers dates, prices, instalments/payment details, location, capacity, description, inclusions/exclusions and the itinerary.

Also: after saving a newly created or duplicated tour, prompt to link a website tour from a list, or mark the tour as "no website tour" so it never asks again.

## What already exists (reused, not rebuilt)
- `wp-content-proxy` edge function with `suggest_tour_matches`, `link_tour`, `get_tour_diff`, `push_tour_diff`, `inclusions_diff`, `push_inclusions`, `pull_inclusions`, `itinerary_diff`, `push_itinerary`
- Field map (`wordpressFieldMap.ts`) defining ART↔WP field pairs and semantic comparison
- Website tab (`TourWebsiteSyncTab`) for matching/linking, and the after-save push prompt (`TourEditWordpressSyncPrompt`)

## New behaviour

### 1. Reconciliation wizard (new dialog)
Opens automatically right after a successful link, and available any time from the Website tab as "Reconcile with website".

Steps:
1. **Fields** — one row per mapped field: website value vs ART value, with a three-way choice: `Keep ART (push)`, `Use website (pull)`, `Leave as is`. Defaults: when ART is empty and the website has a value → pull; otherwise → push. Unchanged fields collapse into a "matching" summary.
2. **Inclusions & exclusions** — side-by-side lists with `Keep ART` / `Use website` / `Skip` for each of the two lists (list-level, since these are ordered repeaters).
3. **Itinerary** — day-by-day diff (existing `itinerary_diff` output) with `Keep ART (publish)` / `Use website (import)` / `Skip` at the itinerary level.
4. **Review & apply** — summary of what will change on each side, then apply.

Apply order: pulls into ART first (so ART is correct), then pushes to the website, then a final verification diff so the closing screen shows what still differs.

### 2. Pull direction (new proxy ops)
Server-side additions to `wp-content-proxy`:
- `pull_tour_fields` — accepts `art_tour_id` + selected `art_keys`, reads the linked WP tour, maps values back via `fromWp` (dates normalised to `yyyy-MM-dd`, money stripped to numeric), updates `tours`, and records an audit row.
- `pull_itinerary` — imports WP itinerary rows into `tour_itinerary_days` / entries for the linked tour, replacing existing days, with a `confirm` guard.
- Inclusions/description pull uses the existing `pull_inclusions` op.
All pulls write to `wordpress_integration_audit_logs` and reuse the existing website-change recording so nothing bypasses the approval trail.

### 3. Link prompt on create / duplicate
- New column `tours.website_link_status` (`unlinked` | `linked` | `no_website_tour`).
- After a tour is created or duplicated, show a prompt: pick a website tour from the suggested-match list, search all website tours, or choose "No website tour — independent tour". Choosing a tour links it and opens the reconciliation wizard; choosing "no website tour" sets `no_website_tour` and suppresses future prompts (reversible from the Website tab).
- Tours still `unlinked` surface as a Tour Readiness / Website tab warning rather than a repeated popup.

## Technical notes
- Date parsing on pull: WP dates arrive as `Ymd` or free text; coerce to `yyyy-MM-dd` and reject anything unparseable with a per-field warning instead of a hard failure.
- Money pull: strip `$`/commas to a numeric value for `price_single`/`price_twin`/`price_double`; leave `instalment_details` as HTML.
- Pull operations are admin/manager only, matching the existing push permission checks.
- Wizard state is local; each step's apply is a separate proxy call so a partial failure reports precisely which field or section failed.
- Migration required for `tours.website_link_status` (default `unlinked`, backfilled to `linked` where a `wordpress_tour_links` row exists).
