# ART Marketing & CRM — Team User Guide

Everything below lives inside the ART admin system (sidebar → **Marketing**). No Keap, no Brevo — the contacts, tours and bookings you see are the live operational data.

---

## 1. The big picture

```text
Public form (/f/your-slug)
        │  someone registers interest / requests a booking
        ▼
Contact created or matched  ──►  Task created ("Register interest received – Jane Doe")
        │                                   │
        ▼                                   ▼
Leads pipeline (stages)            Contact profile → Leads & Tasks history
        │
        ▼
Tags & Segments  ──►  Audience  ──►  Campaign (EDM)  ──►  Sent + open/click tracking
```

Four tabs in **Marketing**:

| Tab | What it's for |
| --- | --- |
| **Campaigns** | Build, preview, test and send EDMs. |
| **Audiences** | Saved segments (who gets the EDM). |
| **Leads** | Pipeline of enquiries and booking requests. |
| **Forms** | Public interest and booking forms you link or embed on the website. |

---

## 2. Contacts, tags and states

**Tags** are your free-form labels — "Ladies", "Indian Derby Interest 2028", "VIP", "Lapsed".

- Add them on a **contact** (Contact profile → *Tags* card, or inside the edit modal).
- Add them on a **booking** (Booking → Edit → *Tags & Segments*).
- Type a new name in the picker and it's created on the spot, colour and all. Tags are shared across the team, so keep names tidy.

**State** is now a fixed dropdown (NSW, VIC, QLD, WA, SA, TAS, ACT, NT) wherever a contact is edited. That's what makes state-based segments reliable — free text like "Melbourne" or "victoria" can't sneak in any more.

> Rule of thumb: **State** = where they live. **Tags** = what they're interested in or who they are.

---

## 3. Audiences (segments)

**Marketing → Audiences → New audience.**

Filter by any combination of:

- States
- Lead stages (New, Contacted, Qualified, Proposal, Won, Lost)
- Lead source
- **Tags** — a contact must carry *every* selected tag
- Past travellers only / Never travelled
- Interested in a specific tour
- Last travelled before a date (win-back)
- Free text on name or email

As you tick filters, the live **recipient count** updates. Save it with a clear name ("VIC ladies – Indian Derby interest").

Two things happen automatically on every audience, always:

1. Only contacts **with marketing consent** are included.
2. One send per email address — duplicates are collapsed.

Audiences are dynamic: they re-resolve at send time, so a contact tagged this morning is in tonight's send.

---

## 4. Campaigns (EDM builder)

**Marketing → Campaigns → New campaign.**

1. **Choose a starter layout** or begin blank.
2. **Add blocks** — heading, text, image, button, two-column, quote/testimonial, tour card, divider, spacer. Drag to reorder, duplicate or delete.
3. **Merge fields** — insert `{{first_name}}` and friends from the toolbar so each email is personalised.
4. **Preview** in desktop and mobile. Emails render fluid to a max width of 800px, so they look right on phones.
5. **Send a test to yourself** before anything else. Always.
6. **Pick the audience**, then **Send** (or schedule).

Sending is throttled and chunked deliberately, so a large send takes a few minutes to work through — that's normal, not a stall. Progress and per-recipient status appear on the campaign.

**Save as template** turns a finished campaign into a reusable starting point for the team.

**After sending** you get delivered / opened / clicked / bounced counts. Bounces feed the existing suppression list automatically — a hard-bounced address won't be emailed again unless someone reactivates it.

---

## 5. Forms (interest + booking)

**Marketing → Forms.** Two types:

- **Register interest** — name, contact details, state, and tick-boxes for the tours they're keen on.
- **Booking form** — full booking details: passenger names, room type, requests and so on.

For each form you get:

- A public link: `yoursite/f/your-slug` — send it, put it in an EDM, or use the **Copy embed code** button to drop an iframe into the WordPress page.
- Editable heading, intro text, button label, success message and redirect.
- A **lead source** label so you can segment on where they came from.
- Optional **Teams notification** when a submission lands.

### What a submission does automatically

1. Matches an existing contact by email/name, or creates one (never overwrites an existing person's name).
2. Records the marketing consent tick.
3. Creates a linked **Task**:
   - Interest → *"Register interest received – [Name]"* with the tours they ticked in the details.
   - Booking → *"Booking received – send invoice"* with all booking details in the description.
4. Files the submission against the contact's **Leads & Tasks** history.

Tasks go to the right department and behave like every other task — assignees, approvals, comments, Teams alerts.

---

## 6. Leads pipeline

**Marketing → Leads** is a Kanban board by lead stage: New → Contacted → Qualified → Proposal → Won / Lost.

- Drag a card to move the stage; the contact record updates.
- Open a card to jump to the contact or its task.
- Stages are a filter option in Audiences, so "everyone stuck at Proposal" is one segment away.

Nothing is ever lost: completing a task archives it under the contact rather than deleting it, so the full history of leads, bookings and conversations stays on the profile.

---

## 7. Suggested weekly rhythm

1. **Monday** — clear new form submissions from the Leads board; tag anyone whose interests are now clear.
2. **Midweek** — build or refresh the audience for this week's send; check the recipient count looks sane.
3. **Before sending** — test email to yourself on desktop *and* phone.
4. **Send**, then check opens/clicks after 24–48 hours.
5. **Monthly** — review tag names for duplicates, and work the win-back segment (last travelled before X).

---

## 8. Gotchas worth knowing

- **No consent, no email.** A contact without marketing consent will never appear in an audience, no matter the filters.
- **Tags are AND, not OR.** Two tags selected means "has both". For "either/or", make two audiences.
- **Tag names are shared.** "ladies" and "Ladies" are the same tag by design; don't invent near-duplicates.
- **Dates are Australian** (dd/mm/yyyy) everywhere in the system.
- **Forms are public.** Anything you type into the heading/intro is visible to the world — no internal notes there.
- **Big sends take minutes.** Sending is paced to protect deliverability; let it finish rather than re-sending.
