import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { OperationsDocCategory } from "@/hooks/useOperationsDocuments";

export interface OperationsDocSection {
  id: string;
  category: OperationsDocCategory;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const useOperationsDocumentSections = (category: OperationsDocCategory) => {
  return useQuery({
    queryKey: ["operations-doc-sections", category],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operations_document_sections")
        .select("*")
        .eq("category", category)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return data as OperationsDocSection[];
    },
  });
};

const invalidate = (qc: ReturnType<typeof useQueryClient>, category: OperationsDocCategory) => {
  qc.invalidateQueries({ queryKey: ["operations-doc-sections", category] });
  qc.invalidateQueries({ queryKey: ["operations-documents", category] });
};

export const useCreateSection = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ category, name }: { category: OperationsDocCategory; name: string }) => {
      const { data: existing } = await supabase
        .from("operations_document_sections")
        .select("sort_order")
        .eq("category", category)
        .order("sort_order", { ascending: false })
        .limit(1);
      const nextOrder = (existing?.[0]?.sort_order ?? 0) + 10;
      const { data, error } = await supabase
        .from("operations_document_sections")
        .insert({ category, name: name.trim(), sort_order: nextOrder })
        .select()
        .single();
      if (error) throw error;
      return data as OperationsDocSection;
    },
    onSuccess: (s) => {
      invalidate(qc, s.category);
      toast({ title: "Section added" });
    },
    onError: (e) => toast({ title: "Failed to add section", description: e instanceof Error ? e.message : "", variant: "destructive" }),
  });
};

export const useRenameSection = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ section, newName }: { section: OperationsDocSection; newName: string }) => {
      const trimmed = newName.trim();
      if (!trimmed || trimmed === section.name) return section;
      // Update docs that reference the old name
      const { error: docErr } = await supabase
        .from("operations_documents")
        .update({ department: trimmed })
        .eq("category", section.category)
        .eq("department", section.name);
      if (docErr) throw docErr;
      const { data, error } = await supabase
        .from("operations_document_sections")
        .update({ name: trimmed })
        .eq("id", section.id)
        .select()
        .single();
      if (error) throw error;
      return data as OperationsDocSection;
    },
    onSuccess: (s) => { invalidate(qc, s.category); toast({ title: "Section renamed" }); },
    onError: (e) => toast({ title: "Failed to rename", description: e instanceof Error ? e.message : "", variant: "destructive" }),
  });
};

export const useDeleteSection = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (section: OperationsDocSection) => {
      // Check if any documents reference this section
      const { count, error: cErr } = await supabase
        .from("operations_documents")
        .select("id", { count: "exact", head: true })
        .eq("category", section.category)
        .eq("department", section.name);
      if (cErr) throw cErr;
      if ((count ?? 0) > 0) {
        throw new Error(`Cannot delete: ${count} file(s) still in this section. Move or delete them first.`);
      }
      const { error } = await supabase
        .from("operations_document_sections")
        .delete()
        .eq("id", section.id);
      if (error) throw error;
      return section;
    },
    onSuccess: (s) => { invalidate(qc, s.category); toast({ title: "Section deleted" }); },
    onError: (e) => toast({ title: "Failed to delete", description: e instanceof Error ? e.message : "", variant: "destructive" }),
  });
};

export const useReorderSections = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ category, ordered }: { category: OperationsDocCategory; ordered: OperationsDocSection[] }) => {
      // Update each row's sort_order in increments of 10
      for (let i = 0; i < ordered.length; i++) {
        const newOrder = (i + 1) * 10;
        if (ordered[i].sort_order === newOrder) continue;
        const { error } = await supabase
          .from("operations_document_sections")
          .update({ sort_order: newOrder })
          .eq("id", ordered[i].id);
        if (error) throw error;
      }
      return category;
    },
    onSuccess: (category) => { invalidate(qc, category); },
    onError: (e) => toast({ title: "Failed to reorder", description: e instanceof Error ? e.message : "", variant: "destructive" }),
  });
};
