# 16 — Public forms and lead intake (Phase 2)

## Public forms

A form is a row in `landing_pages`, rendered at `/f/:slug` and also embeddable in the public website via a snippet. Two form types exist today: **Register Interest** and **Booking Enquiry**. One form is currently configured live.

Staff can edit, per form:

- Which built-in questions appear, and whether each is optional, required or reworded (`StandardFieldsEditor`, `src/lib/marketing/standardFields.ts`)
- Additional custom fields (`src/lib/marketing/formFields.ts`)
- The tour dropdown: available future, non-sold-out tours, plus staff-chosen ordering and extra "tours we may run" entries
- Room type choices (single / twin / double, editable)
- Consent wording, acknowledgement email, task follow-up settings

Booking Enquiry collects what a booking needs: name, email, phone, number of passengers, other passenger names, state of residence, tour, room type, dietary requirements and other requests.

## Submission handling

1. `marketing-landing-page` serves the form definition (public, no auth).
2. `marketing-submit-lead` accepts the submission and writes a row to `landing_page_submissions` (62 columns).
3. `_shared/leadIntake.ts` then performs, in order:
   - **Contact matching** — by email, then by mobile, then by name. An existing contact's name is never overwritten. A new contact is created only when nothing matches.
   - **Enquiry** — creates or reuses a lead, records tour interest in `tour_interests`.
   - **Task** — creates a follow-up task in the existing Task Manager with the configured owner, watchers, priority and due offset. No parallel to-do system.
   - **Timeline** — writes `crm_activities` entries so the enquiry timeline shows the submission.
   - **Consent** — marketing consent is only set when the person actually ticked it; consent flows into the existing marketing eligibility rules, not a separate list.
   - **Acknowledgement email** — sent through the existing email system when enabled for that form.
   - **Attribution** — source, medium, campaign and any tracked-campaign reference are captured and preserved.

## The submission record is immutable

`landing_page_submissions` preserves exactly what the person submitted. Later corrections to the contact, enquiry or tour interest never rewrite it. This is the audit trail for "what did they actually tell us".

## Idempotency and error handling

- A submission row is written before downstream processing, so a failure later never loses the enquiry.
- If downstream processing fails, the submission remains and can be re-run with `crm-reprocess-submission` from Marketing → Submissions.
- Duplicate submissions from a double-click are guarded; repeated genuine submissions create separate submission records but reuse the matched contact.

## Security

- The public endpoints accept only the fields the form defines; input is sanitised.
- No staff token or elevated key is present in the browser for these pages.
- Spam and abuse protection is limited to field validation and shape checks; there is no CAPTCHA today (`UNVERIFIED` whether ART wants one) — recorded in [25-known-issues-debt.md](25-known-issues-debt.md).

## Admin views

Marketing → Landing Pages (form management, slug, embed snippet, field editor) and Marketing → Submissions (every submission, its matched contact and enquiry, reprocess action).

## Live state

`landing_page_submissions` is currently empty, so Submissions will legitimately look empty until the public forms go live on the website.
