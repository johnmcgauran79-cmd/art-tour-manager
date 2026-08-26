# Tags, States & Audiences — Brevo alignment

## Why your VIC audience was empty

1. **No consent anywhere.** All 6,600 contacts have marketing consent off, and audiences hard-filter on consent — so every segment resolves to zero.
2. **States are free text.** Only 670 of 6,600 have a state, split across `VIC` / `Victoria` / `Vic` / `MELBOURNE` / `New Zealand` / `TX`. The state filter matches the exact code `VIC` only (71 rows).

## What gets built

### 1. State clean-up (one-off, reviewable)
- Normalise every existing value to a fixed code: `NSW VIC QLD WA SA TAS ACT NT NZ Overseas`.
- City names map to their state (MELBOURNE→VIC, PERTH→WA, ADELAIDE→SA, BRISBANE→QLD, DARWIN→NT, NEWCASTLE/BLAYNEY→NSW, AUCKLAND/WAIKATO/CANTERBURY/CAMBRIDGE→NZ).
- UK / US states / other countries → `Overseas`.
- `NZ` added as its own option in the state dropdown alongside Overseas.
- Blank states are filled only from Brevo attributes where present; everything else stays blank and is filled manually over time.

### 2. Brevo import (Sync Console in System Settings)
A **Brevo Sync** panel with a two-stage flow — preview, then apply:
- Pulls all Brevo contacts, their list memberships, attributes and blocklist status through the Brevo connector gateway (paged, rate-paced).
- Matches to ART contacts on lowercase email; unmatched Brevo contacts are listed and can be created as new ART contacts in the same run.
- Creates one ART tag per Brevo list (all 42, colour-assigned, list id remembered so re-runs don't duplicate) and applies memberships as contact tags.
- Writes state from Brevo attributes when ART is blank, run through the same normaliser.
- Stores `brevo_contact_id` on the contact for future re-runs.
- Preview screen shows: contacts matched / unmatched, tags to create with counts, states to be filled, consent changes. Nothing is written until you press Apply.

### 3. Consent
- Brevo active/subscribed → consent **on**; Brevo unsubscribed, bounced or blocklisted → consent **off** (and left off).
- Every other contact with an email address → consent **on**.
- Existing hard-bounce suppressions still block sending, so a bad address can't be emailed even if consent is on.

### 4. Audience builder polish
- State filter reads the fixed code list including NZ/Overseas.
- Filter panel shows live counts per state and per tag so an empty segment is obvious before you save it.

## Technical notes
- New columns: `customers.brevo_contact_id` (indexed), `tags.brevo_list_id` (unique, nullable).
- New edge function `brevo-sync-contacts` with `mode: 'preview' | 'apply'`, called from the settings panel; all Brevo calls via `connector-gateway.lovable.dev/brevo`.
- State normaliser extended in `src/lib/auStates.ts` (single source of truth, reused by the sync, contact edit and audience filters).
- Consent + state backfill runs as data updates, not schema migrations, and is idempotent.

## Order of work
1. Schema bits + extended state normaliser.
2. State + consent backfill with a before/after count report.
3. Brevo sync preview.
4. Brevo sync apply (tags, states, consent, brevo ids).
5. Audience builder counts.
