# Sync Inclusions & Exclusions with the Website

## What the website does today

On each tour page:
- **Price section** renders two WordPress ACF repeaters — `inclusions` and `exclusions_details` — as bullet lists.
- **Tour Details section** contains a hand-typed description (intro copy, logo image, and a duplicated "Package Inclusions:" list) inside the WordPress editor.

The system currently stores inclusions and exclusions as two single free-text boxes on Tour Edit, and has no website description field at all. So both shapes need adjusting to match the site.

## What gets built

### 1. Structured item lists in the system
- New **Inclusions & Exclusions** section on the tour (Tour Details area) with two lists.
- Each item is its own row: add, edit, delete, drag to reorder.
- Each item supports light rich text (bold, italic, links) so items like "Travel Insurance (Highly Recommended)" or linked text keep their formatting.
- The old free-text boxes are retired from the edit form; their content stays in the database untouched and is still available to existing email merge fields, which keep working (they render from the new item lists once a tour has items).

### 2. Website description block
- New **Website Description** rich-text block on the tour, mirroring the WordPress Tour Details content (intro paragraphs, notes, and the inclusions copy that appears there).
- Staff edit it in the system; publishing pushes it to the tour page's Details content.
- The publish dialog warns when the inclusions list inside the description differs from the tour's inclusion items, so the two places can't silently drift.

### 3. Pull from website (first load)
- Per-tour **Pull from website** action imports the live `inclusions` / `exclusions_details` rows and the Details description into the system, so nothing is retyped.
- Import is preview-then-confirm: it shows what will be created before writing, and it overwrites the system's lists for that tour only.

### 4. Publish to website (manual, with diff)
- Extends the existing **Publish to website** dialog (already used for the itinerary) with Inclusions, Exclusions, and Website Description sections.
- Shows a row-by-row before/after diff, staff approve, then it writes the repeaters and description on the linked WordPress tour post and verifies the result.
- Nothing auto-publishes. The system stays the source of truth; the website is only changed on an explicit push.

### 5. Codex / MCP access
- Read: `get_tour_inclusions` (items + website description).
- Write: `update_tour_inclusions`, `reorder_tour_inclusions`, `update_tour_website_description` — admin/manager only, same permission model as the other write tools.
- Sync: `wordpress_pull_tour_inclusions`, `wordpress_preview_tour_inclusions`, `wordpress_push_tour_inclusions` (push requires `confirm=true`), matching the itinerary tools' behaviour.

## Technical notes

- New table `tour_inclusion_items`: `tour_id`, `kind` (`inclusion` | `exclusion`), `content_html`, `sort_order`. Staff read/write via the existing role checks; no anon access. Tour duplication copies items; tour delete cascades.
- New column `tours.website_description` (HTML).
- WordPress row shape for each repeater is read back from the live post before the first push (via the existing field-discovery path) and written in exactly that shape, so the theme's rendering is unchanged.
- Rich text is stored and pushed as sanitised inline HTML (bold/italic/links only) — no block elements that could break the theme's bullet markup.
- New proxy operations in `wp-content-proxy`: `inclusions_diff`, `push_inclusions`, `pull_inclusions`, reusing the existing audit logging and semantic comparison helpers.
- `wp-content-proxy` and `mcp` need a manual CLI redeploy after this lands (this project's Supabase is user-managed).
