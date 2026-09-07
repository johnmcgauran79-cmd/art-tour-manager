import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Microsoft 365 correspondence in the CRM.
 *
 * Reading is entirely through the `crm_emails` tables (row level security
 * decides which mailboxes a person may read). Sending, replying and syncing go
 * through the ms-mail-* edge functions so Microsoft 365 stays the email system.
 */

const db = supabase as any;

export interface Mailbox {
  id: string;
  address: string;
  display_name: string | null;
  kind: "shared" | "individual";
  owner_user_id: string | null;
  is_enabled: boolean;
  sync_enabled: boolean;
  history_months: number;
  last_sync_at: string | null;
  last_success_at: string | null;
  last_sync_status: "never" | "ok" | "running" | "error";
  last_error: string | null;
  notes: string | null;
}

export interface CrmEmailRecipient {
  name?: string | null;
  address?: string | null;
}

export interface CrmEmailAttachment {
  id: string;
  name: string;
  contentType?: string;
  size?: number;
  isInline?: boolean;
}

export interface CrmEmail {
  id: string;
  mailbox_id: string;
  conversation_id: string | null;
  subject: string | null;
  preview: string | null;
  body_html: string | null;
  body_text: string | null;
  from_name: string | null;
  from_address: string | null;
  to_recipients: CrmEmailRecipient[];
  cc_recipients: CrmEmailRecipient[];
  occurred_at: string;
  direction: "inbound" | "outbound";
  has_attachments: boolean;
  attachments: CrmEmailAttachment[];
  web_link: string | null;
  sent_from_art_admin: boolean;
  mailbox?: { id: string; address: string; display_name: string | null } | null;
  links?: {
    id: string;
    lead_id: string | null;
    tour_id: string | null;
    booking_id: string | null;
    confidence: string;
    link_source: string;
    lead?: { id: string; stage: string; tour?: { id: string; name: string } | null } | null;
  }[];
  contacts?: { customer_id: string; role: string }[];
}

const EMAIL_SELECT = `
  id, mailbox_id, conversation_id, subject, preview, body_html, body_text,
  from_name, from_address, to_recipients, cc_recipients, occurred_at, direction,
  has_attachments, attachments, web_link, sent_from_art_admin,
  mailbox:email_mailboxes(id, address, display_name),
  links:crm_email_links(id, lead_id, tour_id, booking_id, confidence, link_source,
    lead:leads(id, stage, tour:tours!leads_tour_id_fkey(id, name))),
  contacts:crm_email_contacts(customer_id, role)
`;

export interface EmailFilters {
  direction?: "all" | "inbound" | "outbound";
  mailboxId?: string;
  leadId?: string;
  from?: string;
  to?: string;
  search?: string;
}

export const PAGE_SIZE = 25;

/* ------------------------------- mailboxes ------------------------------- */

export const useMailboxes = () =>
  useQuery({
    queryKey: ["crm-mailboxes"],
    staleTime: 60_000,
    queryFn: async (): Promise<Mailbox[]> => {
      const { data, error } = await db
        .from("email_mailboxes")
        .select("*")
        .order("kind")
        .order("address");
      if (error) throw error;
      return data || [];
    },
  });

export const useUpdateMailbox = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Mailbox> & { id: string }) => {
      const { error } = await db.from("email_mailboxes").update(patch).eq("id", id);
      if (error) throw error;
      await db.rpc("log_sensitive_operation", {
        operation_type: "mailbox_settings_changed",
        table_name: "email_mailboxes",
        record_id: id,
        details: patch,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-mailboxes"] });
      toast({ title: "Mailbox updated" });
    },
    onError: (e: any) => toast({ title: "Could not update mailbox", description: e.message, variant: "destructive" }),
  });
};

export const useCreateMailbox = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (payload: { address: string; display_name?: string; kind: "shared" | "individual"; owner_user_id?: string | null }) => {
      const { data, error } = await db.from("email_mailboxes").insert(payload).select("id").single();
      if (error) throw error;
      await db.rpc("log_sensitive_operation", {
        operation_type: "mailbox_added",
        table_name: "email_mailboxes",
        record_id: data.id,
        details: payload,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-mailboxes"] });
      toast({ title: "Mailbox added", description: "Turn it on once Microsoft access is approved." });
    },
    onError: (e: any) => toast({ title: "Could not add mailbox", description: e.message, variant: "destructive" }),
  });
};

export const useMailboxSyncRuns = (mailboxId?: string) =>
  useQuery({
    queryKey: ["crm-mailbox-runs", mailboxId ?? "all"],
    staleTime: 15_000,
    queryFn: async () => {
      let q = db
        .from("email_sync_runs")
        .select("*, mailbox:email_mailboxes(address, display_name)")
        .order("started_at", { ascending: false })
        .limit(40);
      if (mailboxId) q = q.eq("mailbox_id", mailboxId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

export const useRunMailSync = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (payload: { mailboxId?: string; mode: "manual" | "historical"; months?: number }) => {
      const { data, error } = await supabase.functions.invoke("ms-mail-sync", { body: payload });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["crm-mailbox-runs"] });
      qc.invalidateQueries({ queryKey: ["crm-mailboxes"] });
      qc.invalidateQueries({ queryKey: ["crm-emails"] });
      const stored = (data?.results || []).reduce((n: number, r: any) => n + (r.stored || 0), 0);
      toast({ title: "Sync finished", description: `${stored} new email${stored === 1 ? "" : "s"} brought in.` });
    },
    onError: (e: any) => toast({ title: "Sync failed", description: e.message, variant: "destructive" }),
  });
};

export const useMailboxAccess = (mailboxId?: string) =>
  useQuery({
    queryKey: ["crm-mailbox-access", mailboxId],
    enabled: !!mailboxId,
    queryFn: async () => {
      const { data, error } = await db
        .from("email_mailbox_access")
        .select("id, user_id, created_at")
        .eq("mailbox_id", mailboxId);
      if (error) throw error;
      return data || [];
    },
  });

export const useSetMailboxAccess = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ mailboxId, userId, grant }: { mailboxId: string; userId: string; grant: boolean }) => {
      if (grant) {
        const { error } = await db.from("email_mailbox_access").insert({ mailbox_id: mailboxId, user_id: userId });
        if (error) throw error;
      } else {
        const { error } = await db
          .from("email_mailbox_access")
          .delete()
          .eq("mailbox_id", mailboxId)
          .eq("user_id", userId);
        if (error) throw error;
      }
      await db.rpc("log_sensitive_operation", {
        operation_type: grant ? "mailbox_access_granted" : "mailbox_access_revoked",
        table_name: "email_mailbox_access",
        record_id: mailboxId,
        details: { userId },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-mailbox-access"] });
      toast({ title: "Access updated" });
    },
    onError: (e: any) => toast({ title: "Could not change access", description: e.message, variant: "destructive" }),
  });
};

/* --------------------------------- emails -------------------------------- */

const applyFilters = (q: any, f: EmailFilters) => {
  if (f.direction && f.direction !== "all") q = q.eq("direction", f.direction);
  if (f.mailboxId) q = q.eq("mailbox_id", f.mailboxId);
  if (f.from) q = q.gte("occurred_at", f.from);
  if (f.to) q = q.lte("occurred_at", `${f.to}T23:59:59`);
  if (f.search) q = q.or(`subject.ilike.%${f.search}%,preview.ilike.%${f.search}%`);
  return q;
};

/** Correspondence involving one contact, newest first, paginated. */
export const useContactEmails = (
  customerId: string | undefined,
  filters: EmailFilters = {},
  page = 0,
) =>
  useQuery({
    queryKey: ["crm-emails", "contact", customerId, filters, page],
    enabled: !!customerId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: links, error: linkErr } = await db
        .from("crm_email_contacts")
        .select("email_id")
        .eq("customer_id", customerId);
      if (linkErr) throw linkErr;
      const ids = (links || []).map((l: any) => l.email_id);
      if (!ids.length) return { rows: [] as CrmEmail[], total: 0 };

      let q = db
        .from("crm_emails")
        .select(EMAIL_SELECT, { count: "exact" })
        .in("id", ids)
        .order("occurred_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      q = applyFilters(q, filters);

      const { data, error, count } = await q;
      if (error) throw error;
      let rows = (data || []) as CrmEmail[];
      if (filters.leadId) {
        rows = rows.filter((r) => (r.links || []).some((l) => l.lead_id === filters.leadId));
      }
      return { rows, total: count ?? rows.length };
    },
  });

/** Correspondence linked to one enquiry. */
export const useLeadEmails = (leadId: string | undefined) =>
  useQuery({
    queryKey: ["crm-emails", "lead", leadId],
    enabled: !!leadId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: links, error: linkErr } = await db
        .from("crm_email_links")
        .select("email_id")
        .eq("lead_id", leadId);
      if (linkErr) throw linkErr;
      const ids = (links || []).map((l: any) => l.email_id);
      if (!ids.length) return [] as CrmEmail[];
      const { data, error } = await db
        .from("crm_emails")
        .select(EMAIL_SELECT)
        .in("id", ids)
        .order("occurred_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as CrmEmail[];
    },
  });

/** Every message in one Microsoft conversation, oldest first. */
export const useEmailThread = (conversationId: string | null | undefined, fallbackId?: string) =>
  useQuery({
    queryKey: ["crm-email-thread", conversationId, fallbackId],
    enabled: !!conversationId || !!fallbackId,
    queryFn: async () => {
      if (!conversationId) {
        const { data, error } = await db.from("crm_emails").select(EMAIL_SELECT).eq("id", fallbackId).limit(1);
        if (error) throw error;
        return (data || []) as CrmEmail[];
      }
      const { data, error } = await db
        .from("crm_emails")
        .select(EMAIL_SELECT)
        .eq("conversation_id", conversationId)
        .order("occurred_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data || []) as CrmEmail[];
    },
  });

/** Emails with no contact match yet - the review queue. */
export const useUnmatchedEmails = (search?: string) =>
  useQuery({
    queryKey: ["crm-emails", "unmatched", search],
    staleTime: 30_000,
    queryFn: async () => {
      let q = db
        .from("crm_emails")
        .select(EMAIL_SELECT)
        .eq("direction", "inbound")
        .eq("is_internal", false)
        .order("occurred_at", { ascending: false })
        .limit(100);
      if (search) q = q.or(`subject.ilike.%${search}%,from_address.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return ((data || []) as CrmEmail[]).filter((e) => !(e.contacts || []).length);
    },
  });

export const useSetEmailLead = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({
      emailId,
      leadId,
      tourId,
      bookingId,
    }: { emailId: string; leadId: string | null; tourId?: string | null; bookingId?: string | null }) => {
      await db.from("crm_email_links").delete().eq("email_id", emailId);
      if (leadId) {
        const { error } = await db.from("crm_email_links").insert({
          email_id: emailId,
          lead_id: leadId,
          tour_id: tourId ?? null,
          booking_id: bookingId ?? null,
          link_source: "manual",
          confidence: "high",
        });
        if (error) throw error;
      }
      await db.rpc("log_sensitive_operation", {
        operation_type: leadId ? "crm_email_linked" : "crm_email_unlinked",
        table_name: "crm_email_links",
        record_id: emailId,
        details: { leadId },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-emails"] });
      qc.invalidateQueries({ queryKey: ["crm-email-thread"] });
      toast({ title: "Enquiry link updated" });
    },
    onError: (e: any) => toast({ title: "Could not change the link", description: e.message, variant: "destructive" }),
  });
};

export const useLinkEmailContact = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ emailId, customerId, remove }: { emailId: string; customerId: string; remove?: boolean }) => {
      if (remove) {
        const { error } = await db
          .from("crm_email_contacts")
          .delete()
          .eq("email_id", emailId)
          .eq("customer_id", customerId);
        if (error) throw error;
      } else {
        const { error } = await db
          .from("crm_email_contacts")
          .insert({ email_id: emailId, customer_id: customerId, role: "to", link_source: "manual" });
        if (error) throw error;
      }
      await db.rpc("log_sensitive_operation", {
        operation_type: remove ? "crm_email_contact_unlinked" : "crm_email_contact_linked",
        table_name: "crm_email_contacts",
        record_id: emailId,
        details: { customerId },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-emails"] });
      toast({ title: "Contact link updated" });
    },
    onError: (e: any) => toast({ title: "Could not change the link", description: e.message, variant: "destructive" }),
  });
};

/** Turn a genuine new enquiry email into a contact (+ optional enquiry). */
export const useCreateContactFromEmail = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({
      emailId,
      firstName,
      lastName,
      email,
      createLead,
      tourId,
    }: {
      emailId: string;
      firstName: string;
      lastName: string;
      email: string;
      createLead: boolean;
      tourId?: string | null;
    }) => {
      const { data: customer, error } = await db
        .from("customers")
        .insert({ first_name: firstName, last_name: lastName, email })
        .select("id")
        .single();
      if (error) throw error;

      await db
        .from("crm_email_contacts")
        .insert({ email_id: emailId, customer_id: customer.id, role: "from", link_source: "manual" });

      let leadId: string | null = null;
      if (createLead) {
        const { data: lead, error: leadErr } = await db
          .from("leads")
          .insert({
            customer_id: customer.id,
            lead_type: "general",
            tour_id: tourId ?? null,
            stage: "new",
            priority: "medium",
            source: "email",
          })
          .select("id")
          .single();
        if (leadErr) throw leadErr;
        leadId = lead.id;
        await db.from("crm_email_links").insert({
          email_id: emailId,
          lead_id: leadId,
          tour_id: tourId ?? null,
          link_source: "manual",
          confidence: "high",
        });
      }

      await db.rpc("log_sensitive_operation", {
        operation_type: "crm_contact_created_from_email",
        table_name: "customers",
        record_id: customer.id,
        details: { emailId, leadId },
      });

      return { customerId: customer.id, leadId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-emails"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Contact created" });
    },
    onError: (e: any) => toast({ title: "Could not create the contact", description: e.message, variant: "destructive" }),
  });
};

export const useSendCrmEmail = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (payload: {
      mailboxId: string;
      mode?: "new" | "reply" | "replyAll";
      replyToEmailId?: string;
      to?: string[];
      cc?: string[];
      subject?: string;
      html: string;
      customerId?: string | null;
      leadId?: string | null;
      tourId?: string | null;
      bookingId?: string | null;
    }) => {
      const { data, error } = await supabase.functions.invoke("ms-mail-send", { body: payload });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-emails"] });
      qc.invalidateQueries({ queryKey: ["crm-email-thread"] });
      qc.invalidateQueries({ queryKey: ["crm-timeline"] });
      toast({ title: "Email sent", description: "It's in Outlook Sent Items and on this record." });
    },
    onError: (e: any) => toast({ title: "Could not send", description: e.message, variant: "destructive" }),
  });
};

export const useDownloadEmailAttachment = () => {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ emailId, attachmentId }: { emailId: string; attachmentId: string }) => {
      const { data, error } = await supabase.functions.invoke("ms-mail-attachment", {
        body: { emailId, attachmentId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const { name, contentType, contentBytes } = data as any;
      const bytes = Uint8Array.from(atob(contentBytes), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: contentType || "application/octet-stream" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (e: any) => toast({ title: "Could not open the attachment", description: e.message, variant: "destructive" }),
  });
};
