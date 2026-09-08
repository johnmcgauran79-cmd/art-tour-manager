# External lead sources (Phase 4)

Leads from outside the ART website — Facebook/Instagram lead ads, Zapier, partner
organisations, any other system — arrive through one secure endpoint and are then
handled by exactly the same intake used by the website forms (Phase 2). There is
no second lead process.

Managed in **Marketing → Lead sources**.

## Setting up a source

1. Marketing → Lead sources → **Add lead source**. Give it a name, a short
   reference (for example `zapier`), where the leads come from, the owner,
   follow-up days, task priority, tags, who gets the task, and an acknowledgement
   email if wanted.
2. Press **Create key**. The key is shown once — copy it into the outside system.
   Creating a new key immediately stops the old one working.
3. Switch the source on. While it is off, leads from it are refused.

## Sending a lead

```
POST https://upqvgtuxfzsrwjahklij.supabase.co/functions/v1/lead-intake
x-api-key: <the key>
Content-Type: application/json

{
  "external_submission_id": "unique-id-from-your-system",
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane@example.com",
  "phone": "0412 345 678",
  "state": "VIC",
  "travellers": 2,
  "tour": "2026 Cox Plate Weekend Tour",
  "message": "Interested in a twin room",
  "consent": true
}
```

Also accepted: `tour_ids` (ART tour references), `tours` (a list of names),
`full_name`, `mobile`, `country`, `preferred_contact`, `previous_traveller`,
`utm_source`/`utm_medium`/`utm_campaign`/`utm_content`/`utm_term`, `referrer`,
`campaign_id`, `adset_id`, `ad_id`, `platform`, `partner`, plus Meta-style
`field_data: [{ name, values: [] }]` and flat Zapier field names.

Responses:

- `200 { ok: true, ... }` — stored and processed.
- `200 { ok: true, duplicate: true }` — we already had that
  `external_submission_id`; nothing was created twice.
- `200 { ok: false, needs_review: true, unmapped_tours: [...] }` — stored and a
  contact/enquiry/task created, but the tour wording needs mapping.
- `401` invalid key · `403` source switched off · `413` payload too large ·
  `429` more than 120 leads a minute from that source · `500` nothing stored.

## Zapier

Action **Webhooks by Zapier → POST**, URL as above, payload type JSON, headers
`x-api-key: <key>`, and map the form fields to the names above.

## Facebook / Instagram lead ads

Two options:

- **Via Zapier** (no extra setup): use the Facebook Lead Ads trigger and the
  Zapier step above.
- **Direct webhook**: point Meta's Lead Ads webhook at
  `/functions/v1/meta-leads-webhook`, with the source `meta_lead_ads` switched on
  and these secrets stored: `META_VERIFY_TOKEN`, `META_APP_SECRET`,
  `META_PAGE_ACCESS_TOKEN`. Every call is signature-checked; the answers are
  fetched from Meta and handed to the same intake.

## Tour wording

Outside systems word tours differently. **Tour wording** on each source maps
their wording to an ART tour (matching ignores capitalisation). Anything
unrecognised is flagged on the submission, where staff can map it and press
**Retry** to finish the enquiry. Mappings are remembered for next time.

## Where leads appear

- Marketing → Submissions — the original, filterable by source, with retry.
- Leads pipeline — filter **Where from** for Facebook, Zapier, partners, etc.
- Contact timeline, follow-up task, and tour interests as with website enquiries.
