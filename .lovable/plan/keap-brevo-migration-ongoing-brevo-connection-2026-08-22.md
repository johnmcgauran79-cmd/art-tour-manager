# Keap → Brevo migration + ongoing Brevo connection

## How it will work (plain English)

Brevo becomes your CRM for marketing, leads and enquiries (register-interest pages, landing pages). ART Admin stays the system for tours, bookings and tour communications. New people who come in via Brevo flow automatically into ART Admin as contacts; when someone books a tour, ART pushes their updated details and tour tags back to Brevo so marketing always knows who has travelled.

The migration itself is a one-off **Migration Console** built into System Settings. It works in three visible steps so nothing happens blindly:

1. **Pull from Keap** — reads every Keap contact, their tags and their notes into a staging area inside ART. Nothing is sent to Brevo yet.
2. **Review** — an on-screen report: how many contacts, how many duplicates, how many have no email, which Keap tags map to which Brevo lists, who is unsubscribed/bounced, and any conflicts with contacts already in ART.
3. **Push to Brevo** — sends the approved records across in small batches with a live progress bar, then produces a reconciliation report (sent / skipped / failed, with reasons and a re-run button for failures only).

You can run steps 1 and 2 as many times as you like. Step 3 is resumable — if it stops, it picks up where it left off and never double-creates a contact.

## What moves across automatically

- **Contacts and core fields** — first/last name, email, phone (reformatted to +61 style), address, city/state/country, company, created date.
- **Tags** — every Keap tag becomes either a Brevo **list** (for tags you actively market to, e.g. "Melbourne Cup 2026 Interest") or a **contact attribute** (for descriptive tags, e.g. "Female", "Past Traveller"). You choose which is which in the review step; we pre-suggest based on tag usage.
- **Notes** — Keap notes are combined per contact and written into a Brevo text attribute (`KEAP_NOTES`), and also saved into the contact's **Internal Notes** in ART Admin so staff keep full history in the place they actually work.
- **Marketing consent state** — unsubscribed, bounced and hard-blocked contacts are carried across as blocklisted in Brevo. This one is non-negotiable and is the single biggest compliance risk if skipped.
- **Keap IDs** — each ART contact keeps `keap_contact_id` and gains `brevo_contact_id`, so we can always trace a record back.

## What cannot move (and what to do instead)

| Item | Why | What you do |
| --- | --- | --- |
| Email campaign history / stats | No API for importing past sends | Export Keap reports to PDF/CSV as an archive before cancelling Keap |
| Campaign & automation sequences | Different engines entirely | Rebuild your top 3–5 sequences in Brevo by hand (we can list which ones are active in Keap) |
| Landing pages / web forms | Keap-specific HTML | Rebuild in Brevo; new forms feed the ART sync automatically |
| Opportunities / pipeline deals | Different data model | Manual re-entry of *open* deals only, or keep them in ART as tour bookings |
| Files attached to contacts | Not exposed usefully by either API | Download the handful that matter; most sit in ART already |
| Tasks & appointments | ART already owns tasks | Nothing — use ART Tasks |
| Email templates | Different merge-field syntax | Rebuild the 2–3 marketing templates you still use |

## Things to watch out for

- **Sender domain must be authenticated in Brevo first.** Until DNS records are in, campaigns will land in spam. This is step one and takes 24–48 hours to verify.
- **Don't blast straight away.** After import, warm up: send to your most engaged segment first, then widen over 1–2 weeks. A cold list of thousands sent in one go damages your domain reputation.
- **Duplicates.** Brevo keys everything off email. Two Keap contacts with the same email will merge into one Brevo contact — the review step shows exactly which ones and lets you pick the survivor.
- **Contacts with no email** cannot exist in Brevo. They stay in ART only; the report lists them.
- **Tag sprawl.** Keap accounts typically have hundreds of stale tags. We'll show usage counts so you can archive the dead ones instead of importing clutter.
- **API rate limits.** Both providers throttle us, so the pull and push run in paced batches — expect the full run to take a while (roughly an hour per 10k contacts) rather than seconds. It runs in the background; you can close the tab.
- **Keap stays read-only during the move.** Once we pull, avoid editing in Keap so the two don't drift. Cancel Keap only after the reconciliation report is clean.
- **Cost check.** Brevo pricing is by contact volume — the review step gives you the final contact count before you commit to a plan.

## Ongoing connection (after the move)

- **Brevo → ART**: new or updated Brevo contacts (leads from register-interest and landing pages) are picked up automatically and created in ART Admin as contacts, tagged as a lead with their source. Existing contacts are matched on email and never overwritten with blanks.
- **ART → Brevo**: when a booking is created or a tour completes, ART updates that contact in Brevo — latest tour, tour tags, phone/name corrections, and adds them to the relevant list.
- **Health panel**: Brevo joins Xero/WordPress/Teams in the Integrations panel in System Settings, showing last sync time, match coverage and any failures.
- Keap's integration is switched off and removed once you confirm you're happy.

## What you need to do (your checklist)

1. Create a Brevo account and pick a plan (I'll tell you the contact count first if you'd rather wait).
2. Authenticate your sending domain in Brevo (DNS records — I'll give you the exact values to hand to whoever manages your DNS).
3. Give me a Brevo API key, and confirm your Keap API access still works.
4. Sit with me for the review step and make the calls on tags, duplicates and which sequences to rebuild.
5. Rebuild the handful of campaigns/forms in Brevo (I can draft the content).

## Technical outline

- New tables: `crm_migration_runs` (run status, counts, phase) and `crm_migration_contacts` (staged Keap record, mapped Brevo payload, per-row status/error, `keap_contact_id`, resulting `brevo_contact_id`) — admin-only RLS.
- New column `customers.brevo_contact_id` (+ index), `customers.crm_source`.
- New tables `crm_tag_map` (keap tag → brevo list or attribute, decision persisted).
- Edge functions: `crm-migrate-pull` (paged Keap contacts + tags + notes into staging, resumable cursor), `crm-migrate-push` (batched Brevo `contacts/import` and blocklist calls, per-row error capture), `crm-migrate-report` (reconciliation), `brevo-sync-inbound` (poll/webhook → ART customers), `brevo-sync-outbound` (booking/tour triggers → Brevo attributes + lists).
- All Brevo calls go through the Lovable connector gateway (`connector-gateway.lovable.dev/brevo`) using the linked Brevo connection; Keap keeps using `KEAP_API_KEY`.
- UI: `src/components/settings/CrmMigrationConsole.tsx` under System Settings with the three-step wizard, plus a Brevo card in the existing Integrations panel and `useIntegrationHealth` extended.
- Existing `keap-match-contacts-by-email` and the Keap health card are retired at the end, not at the start.

## Suggested build order

1. Brevo connector linked + health card (proves the connection works).
2. Staging tables + pull from Keap + review report (read-only, zero risk).
3. Push to Brevo + reconciliation.
4. Ongoing two-way sync.
5. Retire Keap.
