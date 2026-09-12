# Tidy-up: remove the Brevo converter and dead code

Nothing below is deleted until you approve it. Tick off what you want gone; anything you're unsure about I'll leave exactly as it is.

## 1. The Keap → Brevo converter (you asked for this to go)

Remove the whole migration console and the ongoing Brevo connection:

- Settings → System: the "CRM (Keap → Brevo)" console and the "Brevo audience sync" panel disappear.
- Three background services that talked to Keap and Brevo (pull, push, report) plus the ongoing Brevo sync service.
- Three staging tables that only ever held the migration's working data (contacts pulled from Keap, run history, tag mapping).
- The Keap tag box on a tour, which only existed to map an old Keap tag to a tour.
- The Keap API key secret, once nothing uses it.

Kept and unaffected: your own in-house Email Marketing, audiences, campaigns, forms, CRM and leads. The live contact counts shown in the audience builder currently sit inside a Brevo file — I'll move that small piece into its own file first so nothing in Marketing changes.

Two related decisions for you:

- **Keap contact matching.** Contacts still store an old Keap contact ID, and the System Health screen shows a "Keap" card based on how many contacts were matched. There's also a Keap matching service that nothing in the app calls any more. Options: (a) remove the Keap health card and matching service but leave the stored IDs untouched as history, or (b) remove all of it including the stored IDs. My recommendation is (a).
- **Old nightly Keap job.** The dead nightly "sync Keap tags" job still sits in the database and can't be removed by us (Supabase permissions). It will keep failing silently and is already ignored by the daily health email. Still worth asking Supabase Support to delete it.

## 2. Screens and features that exist but are unreachable

- **Bedding Review page** — a working page at `/operations/bedding-review` with no button or menu item anywhere, so nobody can reach it. Choose: add it to Operations quick actions, or delete it.
- **Two old approvals panels** — the email approvals and status-change approvals screens were replaced by the combined approvals screen now used in Communications. The old two are no longer shown anywhere. Delete.

## 3. Files nothing uses at all

Safe to delete — nothing in the app references them:

- Task Manager leftovers: All Tasks pop-up, Filtered Tasks pop-up, Quick Task Actions, Task Filters, Bulk Task Operations panel (all superseded by the current Tasks screens).
- Marketing leftover: an old Leads tab component (the live Leads screen is separate).
- Contact import leftovers: CSV error display and CSV preview table.
- An old dashboard header component.
- Unused helper files: secure bookings hook, booking query constants, debug logging helpers, input sanitiser helpers.
- Seven unused design-library pieces that came with the template and were never used: carousel, drawer, empty state, hover card, one-time-code input, menubar, navigation menu.

## 4. Unused bits inside files that are otherwise used

Small dead exports with no callers — removing them changes nothing you can see: create-tour hook, add-relationship and CRM dashboard hooks, unmatched-email hooks, link-lead-to-booking, single custom form, delete-duplicate-contacts, delete-hotel-booking, single campaign, recalculate tour booking dates, reschedule email, update task dependency, single email template, plus a handful of unused date/colour/typography constants.

## 5. Documentation

Update the handover documents and the marketing guide so they no longer describe the Brevo converter or the Brevo sync, and note the Keap decision you pick.

## Technical notes

- Deletions in code are straightforward; the three migration tables and the tour Keap tag column need a database migration, which will pause for your approval separately.
- `useContactStateCounts` moves from `src/hooks/useBrevoAudienceSync.ts` to its own hook file before that file is deleted, keeping `AudiencesTab.tsx` working.
- Edge functions removed: `crm-migrate-pull`, `crm-migrate-push`, `crm-migrate-report`, `brevo-sync`, and (option b only) `keap-match-contacts-by-email`; their `supabase/config.toml` entries go too. `_shared/crmMigration.ts` is deleted with them.
- MCP: no tools are affected. The `get_customer` description mentions Keap and will be reworded; `art-ai-chat/index.test.ts` asserts Keap IDs stay hidden and is updated only if we drop the columns.
- After the code changes you'll need to pull and redeploy locally, and delete the removed functions with `supabase functions delete <name> --project-ref upqvgtuxfzsrwjahklij`.
- Verification: typecheck plus build, and a click-through of Settings → System, Marketing → Audiences, and Communications approvals.
