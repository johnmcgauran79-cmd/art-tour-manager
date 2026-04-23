import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AdditionalFromEmail {
  id: string;
  email: string;
  label: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const useAdditionalFromEmails = () => {
  return useQuery({
    queryKey: ["additional-from-emails"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("additional_from_emails")
        .select("*")
        .order("sort_order")
        .order("email");
      if (error) throw error;
      return (data ?? []) as AdditionalFromEmail[];
    },
  });
};

export const useCreateAdditionalFromEmail = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: { email: string; label?: string | null; sort_order?: number }) => {
      const { data, error } = await supabase
        .from("additional_from_emails")
        .insert({
          email: input.email.trim().toLowerCase(),
          label: input.label?.trim() || null,
          sort_order: input.sort_order ?? 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data as AdditionalFromEmail;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["additional-from-emails"] });
      qc.invalidateQueries({ queryKey: ["user-emails"] });
      toast({ title: "Email added", description: "The address is now available in From dropdowns." });
    },
    onError: (err: any) => {
      const msg = err?.message?.includes("duplicate")
        ? "That email address is already in the list."
        : err?.message || "Failed to add email.";
      toast({ title: "Could not add email", description: msg, variant: "destructive" });
    },
  });
};

export const useUpdateAdditionalFromEmail = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: { id: string } & Partial<Pick<AdditionalFromEmail, "email" | "label" | "is_active" | "sort_order">>) => {
      const updates: any = { ...patch };
      if (typeof updates.email === "string") updates.email = updates.email.trim().toLowerCase();
      if (typeof updates.label === "string") updates.label = updates.label.trim() || null;
      const { data, error } = await supabase
        .from("additional_from_emails")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as AdditionalFromEmail;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["additional-from-emails"] });
      qc.invalidateQueries({ queryKey: ["user-emails"] });
    },
    onError: (err: any) => {
      toast({ title: "Could not update email", description: err?.message ?? "Try again.", variant: "destructive" });
    },
  });
};

export const useDeleteAdditionalFromEmail = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("additional_from_emails").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["additional-from-emails"] });
      qc.invalidateQueries({ queryKey: ["user-emails"] });
      toast({ title: "Email removed" });
    },
    onError: (err: any) => {
      toast({ title: "Could not remove email", description: err?.message ?? "Try again.", variant: "destructive" });
    },
  });
};