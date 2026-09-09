# 15 — Microsoft 365 correspondence (Phase 3)

Purpose: let authorised staff open a Contact or Enquiry and see the relevant individual correspondence, without leaving ART Admin. This is completely separate from ART Email Marketing and does not touch it.

## App model

A single Microsoft Entra app registration — **"Australian Racing Tours - Teams Notifications"** (app id ending `f95ef334`) — carries the Graph application permissions for mailbox access, with tenant admin consent granted. Credentials: `MS_GRAPH_TENANT_ID`, `MS_GRAPH_CLIENT_ID`, `MS_GRAPH_CLIENT_SECRET`, `MS_GRAPH_REDIRECT_URI`.

Because the permissions are application-level, ART controls visibility itself through `email_mailboxes` and `email_mailbox_access` — Graph would otherwise expose every mailbox in the tenant.

## Data model

| Table | Role |
| --- | --- |
| `email_mailboxes` | One row per mailbox: address, display name, kind (`individual`/`shared`), `is_enabled`, `sync_enabled`, `history_months`, delta links, last sync status/error |
| `email_mailbox_access` | Which staff user may read which mailbox |
| `crm_emails` | The message: subject, direction, timestamps, body/preview, mailbox, Graph ids |
| `crm_email_contacts` | Message ↔ contact links (the matching result) |
| `crm_email_links` | Message ↔ booking / tour / lead / task links |
| `email_sync_runs` | Every sync attempt, for diagnosis |

## Functions

| Function | Purpose |
| --- | --- |
| `ms-mail-sync` | Delta sync and historical import. History import walks **one month at a time**, backwards, so a 12-month import is many passes rather than one long request |
| `ms-mail-send` | Sending from a mailbox where used |
| `ms-mail-attachment` | Fetching an attachment on demand |

Schedule: `ms-mail-delta-sync` runs every 15 minutes (`{"mode":"delta"}`).

## Live state (8 September 2026)

| Mailbox | Kind | Enabled | Last sync | History |
| --- | --- | --- | --- | --- |
| admin@ | shared | yes | ok | 12 months |
| bookings@ | shared | yes | ok | 12 months |
| info@ | shared | yes | ok | 12 months |
| belinda@ | individual | yes | ok | 12 months |
| donna@ | individual | yes | ok | 12 months |
| jane@ | individual | yes | ok | 12 months |
| john@ | individual | yes | ok | 12 months |
| monique@ | individual | yes | ok | 12 months |
| tara@ | individual | yes | ok | 12 months |
| news.tours@ | shared | **no** | error | n/a |

`news.tours@` is deliberately disabled: it is the send-only marketing subdomain and has no Microsoft mailbox. Its stored error message says exactly that. Leave it disabled.

Volume: 12,771 messages stored, with 3,849 message-to-contact links recorded by automatic matching.

## Matching and visibility

Messages are matched to contacts by participant email address. A message with no matching contact is still stored but shows nowhere on a contact record. Matching never creates or renames contacts.

Read access is enforced in the database by `can_read_mailbox` / `can_read_crm_email` over `email_mailbox_access` — a staff member does not see a colleague's individual mailbox unless explicitly granted. Attachments are served through short-lived signed access, not public URLs.

## Restrictions and honest limits

- Personal correspondence is sensitive. Grant mailbox access narrowly; see [32-privacy.md](32-privacy.md).
- Sync depends on Microsoft admin consent remaining in place. If consent or the client secret lapses, syncs fail with a recorded error and the interface simply stops updating.
- Historical import beyond the configured 12 months has not been done and would need to be requested per mailbox.
- Threading is reconstructed from Graph conversation identifiers; unusual reply chains may group imperfectly (`UNVERIFIED` in edge cases).
- This system must never be used as a marketing send path.
