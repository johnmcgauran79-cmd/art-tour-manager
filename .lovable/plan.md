# Instalment payment reminders

Build the reminders inside the system (not Xero's own overdue notices), so the email can carry tour and booking details, the exact instalment amount owing, bank details and a card payment link — and so each one passes through the approval queue we already use for automated tour emails.

Xero stays the source of truth for money: every reminder reads the live invoice for currency, total, payments received and balance. Xero's built-in reminders remain off, so clients never get two different chase emails.

## How it works

Reminders are built per **invoice**, not per booking. That single decision handles the tricky cases: two passengers with their own invoices get two reminders, several bookings on one invoice get one reminder, and the invoice tells us who is actually being billed.

Each night the system:

1. Finds tours that require an instalment and whose instalment date has arrived.
2. Collects the bookings on those tours, then groups them by their linked Xero invoice.
3. Reads each invoice live from Xero: currency, invoice total, payments received, balance owing, who it is addressed to, and the Xero payment link.
4. Works out the instalment owing: number of passengers across the bookings on that invoice x the tour's instalment amount, on top of the deposit already expected.
5. Creates a reminder only when payments received are still short of deposit + instalment.
6. Sends it to the review queue with the other automated tour emails, for approval before it goes out.

Anything still unpaid gets a fresh reminder each week, until it's paid or an admin cancels the reminders for that invoice (used when a payment plan has been agreed directly with the client).

## What the email contains

Tour name and dates, booking reference and passenger names, invoice number, invoice total, payments received to date, instalment amount now due, remaining balance, and the final payment due date. Then bank details and a "Pay by card" button using the Xero payment link for that invoice.

All amounts show in the invoice's own currency with the correct symbol (AUD, NZD, USD, GBP, EUR and the rest) — never converted, never assumed to be dollars.

## Cases handled deliberately

- **Racing Breaks invoices** — skipped entirely; no instalment is expected of them.
- **Travel agent invoices** — when the invoice is addressed to someone who isn't a passenger on the booking, the amount is usually net of commission, so the instalment maths doesn't apply. These are held aside on the review screen, marked "agent invoice — check manually", and never sent unattended.
- **Cancelled, waitlisted, host and complimentary bookings** — never chased.
- **Already paid, or paid ahead** — no reminder; if the balance is zero the reminder is dropped automatically even after it has queued.
- **No invoice linked yet** — listed as a data issue rather than emailed, so it can be fixed.
- **Xero unreachable** — nothing is queued from stale figures that night; it retries the next night.

## Admin controls

A new "Instalment reminders" screen (under Communications, next to the other automated emails) shows, per tour: who owes, how much, which currency, how many reminders have gone out, and buttons to send, skip once, or stop reminders for that invoice with a short reason. The wording lives in an editable email template, like the receipt email.

## Technical notes

- New rule type `instalment_reminder` in `automated_email_rules` (reuses `requires_approval` and the `automated_email_log` approval flow, so the existing approvals screen picks it up).
- New table `instalment_reminders`: invoice id, invoice number, booking ids, currency, expected instalment, amount paid at time of queueing, reminder count, last sent, state (`pending`, `sent`, `held_agent`, `stopped`, `resolved`), stop reason.
- New edge function `queue-instalment-reminders` (nightly, after the Xero receipt sync so figures are fresh) plus `send-instalment-reminders` modelled on `send-approved-payment-receipts` (same brand resolution, sender identity, currency symbol map, Resend 600 ms spacing).
- Live invoice reads go through the existing Xero helpers with 300 ms spacing and 429 retry; invoice grouping comes from `xero_invoice_mappings`, with the same reference normalisation the data quality checks use.
- Agent detection: compare the invoice's Xero contact against the booking's passenger contacts (email, then name); no match = `held_agent`.
- New `email_templates` row of type `instalment_reminder` with merge fields for the amounts, currency, dates, bank details block and payment link.
