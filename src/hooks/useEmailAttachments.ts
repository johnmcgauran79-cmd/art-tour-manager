import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { emailAttachmentUrl } from "@/lib/emailFileUrl";

export interface EmailAttachment {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  file_path: string;
  file_url: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
}

const BUCKET = "email-attachments";

export const useEmailAttachments = () =>
  useQuery({
    queryKey: ["email-attachments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_attachments")
        .select("*")
        .order("label", { ascending: true });
      if (error) throw error;
      return (data || []) as EmailAttachment[];
    },
  });

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);

interface UploadArgs {
  file: File;
  label: string;
  slug: string;
  description?: string;
  existing?: EmailAttachment | null;
}

export const useUpsertEmailAttachment = () => {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ file, label, slug, description, existing }: UploadArgs) => {
      const cleanSlug = slugify(slug);
      if (!cleanSlug) throw new Error("Slug is required");

      const path = `${cleanSlug}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      if (existing) {
        // Permanent guest link (redirects to a fresh signed URL on each open)
        // so the email-attachments bucket can stay private.
        const fileUrl = emailAttachmentUrl(existing.id);
        // Remove the old file if path changed
        if (existing.file_path && existing.file_path !== path) {
          await supabase.storage.from(BUCKET).remove([existing.file_path]);
        }
        const { error } = await supabase
          .from("email_attachments")
          .update({
            slug: cleanSlug,
            label,
            description: description || null,
            file_path: path,
            file_url: fileUrl,
            file_name: file.name,
            mime_type: file.type || null,
            size_bytes: file.size,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Mint the id up front so the stored link can reference it.
        const id = crypto.randomUUID();
        const { error } = await supabase.from("email_attachments").insert({
          id,
          slug: cleanSlug,
          label,
          description: description || null,
          file_path: path,
          file_url: emailAttachmentUrl(id),
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-attachments"] });
      toast({ title: "Saved", description: "Email attachment saved." });
    },
    onError: (e: any) =>
      toast({
        title: "Error",
        description: e.message || "Failed to save attachment.",
        variant: "destructive",
      }),
  });
};

export const useUpdateEmailAttachmentMeta = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (args: { id: string; label: string; slug: string; description?: string }) => {
      const cleanSlug = slugify(args.slug);
      if (!cleanSlug) throw new Error("Slug is required");
      const { error } = await supabase
        .from("email_attachments")
        .update({ label: args.label, slug: cleanSlug, description: args.description || null })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-attachments"] });
      toast({ title: "Updated", description: "Attachment details updated." });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};

export const useDeleteEmailAttachment = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (att: EmailAttachment) => {
      if (att.file_path) {
        await supabase.storage.from(BUCKET).remove([att.file_path]);
      }
      const { error } = await supabase.from("email_attachments").delete().eq("id", att.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-attachments"] });
      toast({ title: "Deleted", description: "Attachment removed." });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};