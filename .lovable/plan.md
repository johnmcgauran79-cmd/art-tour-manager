# WordPress Sync — Full Tour Parity via Approval Queue

Turn ART Admin into the source of truth for each linked WordPress tour. Every relevant ART edit is captured as a **pending WP update**, shown in a diff-style approval dialog identical to the current WP edit flow, and pushed one-way to WordPress on approval — with drift detection warning if WP was edited directly since the last sync.

## Phase A — Tour Linking (foundation)

1. **New table `wordpress_tour_links`**
   - `tour_id` (FK `tours.id`, unique)
   - `wp_tour_id` (int, unique)
   - `wp_slug`, `wp_title_snapshot`
   - `linked_by`, `linked_at`
   - `last_synced_at`, `last_wp_modified_at` (for drift detection)
   - RLS: admin/manager read/write; service_role all.

2. **Linking UI** — new tab on the tour detail page ("Website Sync"):
   - If unlinked: shows suggested WP tours ranked by name similarity + matching year (using `acf.start_date`). Admin clicks "Link this tour". Also supports manual search + free-form WP Tour ID entry.
   - If linked: shows WP title, slug, last synced timestamp, "Unlink" button, and the pending-changes panel (Phase B).

3. **Backend**: extend `wp-content-proxy` with `suggest_tour_matches` op (name/year fuzzy match) and `link_tour` / `unlink_tour` ops writing to `wordpress_tour_links`.

## Phase B — Pending Changes Queue

1. **New table `wordpress_pending_updates`**
   - `id`, `tour_id`, `wp_tour_id`
   - `field_group` (`headline` | `inclusions` | `exclusions` | `faqs` | `hotels` | `itinerary` | `payment_details` | ...)
   - `field_path` (JSON pointer within the group)
   - `old_value_art`, `new_value_art`, `current_value_wp` (captured at approval time)
   - `status` (`pending` | `approved` | `pushed` | `rejected` | `superseded` | `failed`)
   - `created_by`, `approved_by`, timestamps, `error_message`
   - RLS: admin/manager.

2. **Change capture** — database triggers on `tours`, `hotel_bookings`/`hotels` (tour-scoped), `tour_itineraries` / `tour_itinerary_days` / `tour_itinerary_entries`, and inclusions/FAQ tables (once identified). Trigger fires only when `wordpress_tour_links` row exists for the tour. Each changed field becomes one row in `wordpress_pending_updates`, or supersedes an existing pending row for the same `(tour_id, field_group, field_path)`.

3. **Dashboard widget "Pending Website Updates"** (auto-hides when empty, admin/manager only):
   - Grouped by tour, count badge in sidebar.
   - "Review" opens the same diff dialog pattern as the current WP edit flow, showing ART value → WP value side-by-side per field.
   - Bulk approve / reject / approve-selected.

4. **Approval push** — on approve, `wp-content-proxy` fetches the live WP record, compares `current_value_wp` against the snapshot taken when the pending row was created:
   - Match → push, write audit log, mark `pushed`, update `last_synced_at` / `last_wp_modified_at`.
   - Mismatch → **drift warning** in the dialog: shows "WordPress was changed directly since this update was queued" with the new WP value, and asks admin to confirm overwrite or reject.

## Phase C — Field Mappings

Central mapping module `src/lib/mcp/wordpress/fieldMap.ts` (mirrored server-side) declares, per group, `(ART source → WP ACF key, transform)`. Phase 1 groups already supported on the WP allowlist:

- **Headline**: price, single/twin/double room price, payment_details, start_date, end_date, time_frame, status, capacity, location, radio_book_now, add_download_brochure.
- **Repeaters (existing allowlist)**: inclusions, exclusions_details, faqs_list, add_review.

Phase 1 pending on WP dev work (hotel 1–5 groups, itinerary repeater not yet in REST):

- **Hotels**: map each ART hotel booking (in tour order) to WP `hotel_1`..`hotel_5` field groups.
- **Itinerary**: map `tour_itinerary_days` + entries to WP itinerary repeater rows.

The mapping module makes it obvious which groups are live vs blocked on WP-side REST exposure. Groups that aren't yet writable are captured in the queue but marked "Awaiting WordPress REST exposure" and skipped on push.

## Phase D — Drift Detection

- On every list/get of a linked tour, `wp-content-proxy` stores `modified` (WP `modified` timestamp) into `wordpress_tour_links.last_wp_modified_at`.
- Approval push compares stored value vs `last_synced_at`. If `last_wp_modified_at > last_synced_at` and the specific field diverges from the snapshot, the dialog flags it.
- Nightly cron `wp-drift-scan` refreshes `modified` timestamps for all linked tours so admins see drift warnings even without opening the tour.

## Rollout order

1. Phase A tables + linking UI + suggestions endpoint.
2. Phase C mapping module for headline + existing repeater allowlist.
3. Phase B tables, triggers for headline fields only, dashboard widget with diff+drift dialog, push path through existing `update_tour` op.
4. Extend triggers to inclusions/exclusions/FAQs repeaters.
5. When WP dev exposes hotel + itinerary ACF to REST: extend allowlist, mapping module, and triggers.

## Access & audit

- All new UI + tools gated to admin/manager via `usePermissions` and `requireAdminOrManager` (matches existing WP tooling).
- Every push writes to `wordpress_integration_audit_logs` with before/after snapshots — already in place; pending rows also log approve/reject with actor.
- No new secrets; reuses the existing WordPress connector.

## Technical details

- Triggers use `AFTER UPDATE` with per-column diffs; only rows in `wordpress_tour_links` produce entries.
- Superseding logic: `INSERT ... ON CONFLICT (tour_id, field_group, field_path) WHERE status = 'pending' DO UPDATE` keeps a single live pending row per field.
- WP writes still go through `wp-content-proxy.update_tour` (extended to accept repeater groups already on the allowlist). No direct WP calls from the browser.
- MCP: add `wordpress_link_tour`, `wordpress_list_pending_updates`, `wordpress_approve_pending_updates` (admin/manager) so ART AI can assist with bulk reviews later.
- Reuses existing diff dialog component from the current WP edit flow — refactored into a shared `<WordPressDiffDialog />`.

## Out of scope (for now)

- Two-way sync (WP → ART). Drift is surfaced but never auto-imported.
- Media/featured image sync.
- Non-tour post types (pages) — kept read-only.
