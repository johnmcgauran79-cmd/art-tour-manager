// Server-side twin of src/lib/emailFileUrl.ts — permanent guest links for
// files hyperlinked from emails, served through the `email-file` edge route so
// the `email-attachments` bucket can stay private.

const functionsBase = () => `${Deno.env.get("SUPABASE_URL")}/functions/v1`;

export const emailAttachmentUrl = (attachmentId: string) =>
  `${functionsBase()}/email-file?a=${attachmentId}`;

export const tourPickupDocUrl = (tourId: string) =>
  `${functionsBase()}/email-file?p=${tourId}`;
