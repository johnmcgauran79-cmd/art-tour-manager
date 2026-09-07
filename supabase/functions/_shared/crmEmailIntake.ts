/**
 * Shared intake for Microsoft 365 correspondence.
 *
 * One Microsoft message = ONE crm_emails row (unique on mailbox + graph id and
 * mailbox + internet message id), linked to any number of contacts and to at
 * most one enquiry. Safe to re-run: everything is upsert-based.
 */
import { recipients, stripHtml, type GraphRecipient } from "./msGraphApp.ts";

export interface MailboxRow {
  id: string;
  address: string;
  kind: string;
  display_name: string | null;
}

export interface IntakeResult {
  emailId: string | null;
  created: boolean;
  contactsMatched: number;
  leadLinked: boolean;
  skipped?: string;
}

const OWN_DOMAINS = ["australianracingtours.com.au"];

const isOwnDomain = (address: string | null | undefined) =>
  !!address && OWN_DOMAINS.some((d) => address.toLowerCase().endsWith(`@${d}`));

const CLOSED_STAGES = ["won", "lost", "closed", "converted", "booked", "cancelled"];

/** Normalise for comparison. */
const norm = (v: string | null | undefined) => (v || "").trim().toLowerCase();

function overlapScore(subject: string, tourName: string) {
  const s = norm(subject);
  const t = norm(tourName);
  if (!s || !t) return 0;
  if (s.includes(t)) return 1;
  const words = t.split(/\s+/).filter((w) => w.length > 3);
  if (!words.length) return 0;
  const hits = words.filter((w) => s.includes(w)).length;
  return hits / words.length;
}

export async function ingestMessage(
  db: any,
  mailbox: MailboxRow,
  msg: any,
  opts: { folder?: string; sentFromArtAdmin?: boolean } = {},
): Promise<IntakeResult> {
  if (!msg?.id) return { emailId: null, created: false, contactsMatched: 0, leadLinked: false, skipped: "no id" };
  if (msg.isDraft) {
    return { emailId: null, created: false, contactsMatched: 0, leadLinked: false, skipped: "draft" };
  }

  const from: GraphRecipient = {
    name: msg.from?.emailAddress?.name ?? msg.sender?.emailAddress?.name ?? null,
    address: norm(msg.from?.emailAddress?.address ?? msg.sender?.emailAddress?.address) || null,
  };
  const to = recipients(msg.toRecipients);
  const cc = recipients(msg.ccRecipients);
  const bcc = recipients(msg.bccRecipients);

  const direction = isOwnDomain(from.address) ? "outbound" : "inbound";
  const participants = [...to, ...cc, ...bcc];
  const isInternal =
    isOwnDomain(from.address) && participants.every((p) => isOwnDomain(p.address));

  const bodyHtml: string | null = msg.body?.contentType === "html" ? msg.body?.content ?? null : null;
  const bodyText: string =
    msg.body?.contentType === "text" ? msg.body?.content ?? "" : stripHtml(bodyHtml);

  const occurredAt = msg.receivedDateTime || msg.sentDateTime || new Date().toISOString();

  const row = {
    mailbox_id: mailbox.id,
    graph_message_id: msg.id,
    internet_message_id: msg.internetMessageId ?? null,
    conversation_id: msg.conversationId ?? null,
    conversation_index: msg.conversationIndex ?? null,
    subject: msg.subject ?? "(no subject)",
    preview: (msg.bodyPreview ?? bodyText).slice(0, 500),
    body_html: bodyHtml,
    body_text: bodyText.slice(0, 200000),
    from_name: from.name,
    from_address: from.address,
    to_recipients: to,
    cc_recipients: cc,
    bcc_recipients: bcc,
    sent_at: msg.sentDateTime ?? null,
    received_at: msg.receivedDateTime ?? null,
    occurred_at: occurredAt,
    direction,
    folder: opts.folder ?? null,
    has_attachments: !!msg.hasAttachments,
    web_link: msg.webLink ?? null,
    is_internal: isInternal,
    sent_from_art_admin: !!opts.sentFromArtAdmin,
    sync_status: "synced",
    sync_error: null,
    updated_at: new Date().toISOString(),
  };

  // Idempotent upsert on the Microsoft message identity.
  const { data: upserted, error } = await db
    .from("crm_emails")
    .upsert(row, { onConflict: "mailbox_id,graph_message_id" })
    .select("id, created_at")
    .single();
  if (error) throw error;

  const emailId = upserted.id as string;
  const created =
    !!upserted.created_at &&
    Math.abs(new Date(upserted.created_at).getTime() - Date.now()) < 60_000;

  // ---- Contact matching (deterministic, email address only) ----
  const externalAddresses = Array.from(
    new Set(
      [from, ...participants]
        .map((p) => norm(p.address))
        .filter((a) => a && !isOwnDomain(a)),
    ),
  );

  let contactsMatched = 0;
  let matchedCustomerIds: string[] = [];

  if (externalAddresses.length && !isInternal) {
    const { data: customers } = await db
      .from("customers")
      .select("id, email")
      .in("email", externalAddresses);

    const byEmail = new Map<string, string>();
    for (const c of customers || []) {
      if (c.email) byEmail.set(norm(c.email), c.id);
    }
    // Case-insensitive second pass for stored addresses with different casing.
    if (byEmail.size < externalAddresses.length) {
      for (const addr of externalAddresses) {
        if (byEmail.has(addr)) continue;
        const { data: alt } = await db
          .from("customers")
          .select("id, email")
          .ilike("email", addr)
          .limit(1);
        if (alt?.[0]) byEmail.set(addr, alt[0].id);
      }
    }

    const roleFor = (addr: string) => {
      if (norm(from.address) === addr) return "from";
      if (to.some((r) => norm(r.address) === addr)) return "to";
      if (cc.some((r) => norm(r.address) === addr)) return "cc";
      return "bcc";
    };

    const links = externalAddresses
      .filter((a) => byEmail.has(a))
      .map((a) => ({
        email_id: emailId,
        customer_id: byEmail.get(a)!,
        role: roleFor(a),
        link_source: "auto",
      }));

    matchedCustomerIds = Array.from(new Set(links.map((l) => l.customer_id)));
    contactsMatched = matchedCustomerIds.length;

    if (links.length) {
      const { error: linkErr } = await db
        .from("crm_email_contacts")
        .upsert(links, { onConflict: "email_id,customer_id", ignoreDuplicates: true });
      if (linkErr) console.error("contact link failed", linkErr.message);
    }
  }

  // ---- Enquiry matching (conservative) ----
  let leadLinked = false;
  if (matchedCustomerIds.length) {
    // If any message in this conversation is already linked to an enquiry, reuse it.
    let leadId: string | null = null;
    let confidence = "medium";

    if (row.conversation_id) {
      const { data: siblings } = await db
        .from("crm_emails")
        .select("id")
        .eq("conversation_id", row.conversation_id)
        .neq("id", emailId)
        .limit(50);
      const siblingIds = (siblings || []).map((s: any) => s.id);
      if (siblingIds.length) {
        const { data: existing } = await db
          .from("crm_email_links")
          .select("lead_id, tour_id, booking_id")
          .in("email_id", siblingIds)
          .not("lead_id", "is", null)
          .limit(1);
        if (existing?.[0]?.lead_id) {
          leadId = existing[0].lead_id;
          confidence = "high";
        }
      }
    }

    if (!leadId) {
      const { data: leads } = await db
        .from("leads")
        .select("id, stage, tour_id, updated_at, tour:tours!leads_tour_id_fkey(id, name)")
        .in("customer_id", matchedCustomerIds)
        .order("updated_at", { ascending: false })
        .limit(25);

      const open = (leads || []).filter((l: any) => !CLOSED_STAGES.includes(norm(l.stage)));

      // High confidence: the subject names the enquiry's tour.
      const scored = open
        .map((l: any) => ({ lead: l, score: overlapScore(row.subject, l.tour?.name || "") }))
        .filter((s) => s.score >= 0.6)
        .sort((a, b) => b.score - a.score);

      if (scored.length === 1 || (scored.length > 1 && scored[0].score > scored[1].score)) {
        leadId = scored[0].lead.id;
        confidence = "high";
      } else if (open.length === 1) {
        leadId = open[0].id;
        confidence = "medium";
      }
    }

    if (leadId) {
      const { data: lead } = await db
        .from("leads")
        .select("id, tour_id, booking_id, last_activity_at, first_response_at")
        .eq("id", leadId)
        .maybeSingle();

      const { error: linkErr } = await db.from("crm_email_links").upsert(
        {
          email_id: emailId,
          lead_id: leadId,
          tour_id: lead?.tour_id ?? null,
          booking_id: lead?.booking_id ?? null,
          link_source: "auto",
          confidence,
        },
        { onConflict: "email_id,lead_id", ignoreDuplicates: true },
      );
      if (linkErr) console.error("lead link failed", linkErr.message);
      else leadLinked = true;

      // Last activity reflects the correspondence (tasks are never auto-completed).
      const patch: Record<string, string> = { last_activity_at: occurredAt };
      if (direction === "outbound" && !lead?.first_response_at) {
        patch.first_response_at = occurredAt;
      }
      if (!lead?.last_activity_at || new Date(lead.last_activity_at) < new Date(occurredAt)) {
        await db.from("leads").update(patch).eq("id", leadId);
      }
    }
  }

  return { emailId, created, contactsMatched, leadLinked };
}

/** Attachment metadata (name/size/type only - files stay in Microsoft 365). */
export async function storeAttachmentMetadata(
  db: any,
  emailId: string,
  attachments: any[],
) {
  const meta = (attachments || []).map((a) => ({
    id: a.id,
    name: a.name,
    contentType: a.contentType,
    size: a.size,
    isInline: !!a.isInline,
  }));
  await db.from("crm_emails").update({ attachments: meta }).eq("id", emailId);
}
