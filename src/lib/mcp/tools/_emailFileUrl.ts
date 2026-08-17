/// <reference types="node" />

// Permanent guest-facing links for files hyperlinked from emails. The
// `email-file` edge route resolves the record and redirects to a fresh signed
// URL, so the `email-attachments` bucket can stay private.

const functionsBase = () => `${process.env.SUPABASE_URL}/functions/v1`;

export const emailAttachmentUrl = (attachmentId: string) =>
  `${functionsBase()}/email-file?a=${attachmentId}`;

export const tourPickupDocUrl = (tourId: string) =>
  `${functionsBase()}/email-file?p=${tourId}`;
