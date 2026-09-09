# 17 — External lead integrations

External sources reuse the Phase 2 intake path exactly (`_shared/leadIntake.ts`), so a Meta lead and a website lead behave identically once inside ART.

## Configuration

| Table | Role |
| --- | --- |
| `lead_integrations` | One row per integration: name, provider, enabled flag, hashed API key + key prefix, field mapping, default owner/source/type, task settings |
| `lead_integration_tour_map` | Maps the wording an external source sends (e.g. a Facebook form's tour label) to an actual ART tour |

Keys are stored **hashed**, with only a short prefix shown for identification. The plaintext key is displayed once at creation and cannot be recovered. `lead-integration-keys` manages creation and rotation.

## Endpoints

| Function | Source |
| --- | --- |
| `lead-intake` | Generic partner/Zapier posts, authenticated by integration API key |
| `meta-leads-webhook` | Meta/Facebook lead ads, verified with `META_VERIFY_TOKEN` and signed with `META_APP_SECRET`, retrieving the lead via `META_PAGE_ACCESS_TOKEN` |

Both are `verify_jwt = false` and authorise the caller themselves — see [06-security-rls.md](06-security-rls.md).

## Behaviour

- Every accepted payload is written as a submission record first, then processed, so nothing is lost if mapping fails.
- Idempotency uses the provider's own lead identifier, so Meta's webhook retries do not create duplicate enquiries.
- Unmapped tour wording still creates the enquiry; the tour interest is left unset rather than guessed.
- Failures are recorded and the submission can be reprocessed from Marketing → Submissions.

## Live state

Two integration rows exist — **Meta** and **Zapier** — and both are currently **disabled**. No external leads are flowing at handover. Enabling one requires generating a key (Zapier) or completing Meta webhook verification and page subscription.

Reference: `docs/external-lead-integrations.md` (pre-existing, written for ART staff).
