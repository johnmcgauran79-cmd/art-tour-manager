// Permanent guest-facing links for files hyperlinked from emails.
//
// Recipients open emails weeks later and are never signed in, so email bodies
// must not embed short-lived signed URLs. Instead they point at the `email-file`
// edge route, which resolves the record and redirects to a fresh signed URL.
// This keeps the `email-attachments` bucket private.

const FUNCTIONS_BASE = "https://upqvgtuxfzsrwjahklij.supabase.co/functions/v1";

/** Permanent link to a reusable email attachment (Settings → Email Attachments). */
export const emailAttachmentUrl = (attachmentId: string) =>
  `${FUNCTIONS_BASE}/email-file?a=${attachmentId}`;

/** Permanent link to a tour's Pickup/Arrival document. */
export const tourPickupDocUrl = (tourId: string) =>
  `${FUNCTIONS_BASE}/email-file?p=${tourId}`;
