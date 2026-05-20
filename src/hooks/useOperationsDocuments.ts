import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type OperationsDocCategory = "working_docs" | "policies";

export interface OperationsDocument {
  id: string;
  category: OperationsDocCategory;
  department: string;
  name: string;
  description: string | null;
  note: string | null;
  file_path: string | null;
  file_name: string | null;
  external_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const useOperationsDocuments = (category: OperationsDocCategory) => {
  return useQuery({
    queryKey: ["operations-documents", category],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operations_documents")
        .select("*")
        .eq("category", category)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as OperationsDocument[];
    },
  });
};

export interface CreateOperationsDocumentInput {
  category: OperationsDocCategory;
  department: string;
  name: string;
  description?: string | null;
  note?: string | null;
  file?: File | null;
  external_url?: string | null;
}

export const useCreateOperationsDocument = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateOperationsDocumentInput) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      let file_path: string | null = null;
      let file_name: string | null = null;

      if (input.file) {
        const safeName = `${Date.now()}-${input.file.name}`;
        const path = `${input.category}/${input.department}/${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("operations-documents")
          .upload(path, input.file);
        if (upErr) throw upErr;
        file_path = path;
        file_name = input.file.name;
      }

      const { data, error } = await supabase
        .from("operations_documents")
        .insert({
          category: input.category,
          department: input.department,
          name: input.name,
          description: input.description || null,
          note: input.note || null,
          file_path,
          file_name,
          external_url: input.external_url || null,
          created_by: userData.user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as OperationsDocument;
    },
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ["operations-documents", doc.category] });
      toast({ title: "Document added" });
    },
    onError: (err) => {
      toast({
        title: "Failed to add document",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateOperationsDocumentNote = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { data, error } = await supabase
        .from("operations_documents")
        .update({ note })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as OperationsDocument;
    },
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ["operations-documents", doc.category] });
    },
    onError: (err) => {
      toast({
        title: "Failed to save note",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    },
  });
};

export interface UpdateOperationsDocumentInput {
  id: string;
  category: OperationsDocCategory;
  department?: string;
  name?: string;
  description?: string | null;
  note?: string | null;
  file?: File | null; // new file to replace
  external_url?: string | null;
  clearFile?: boolean; // remove existing file
  existing_file_path?: string | null;
}

export const useUpdateOperationsDocument = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: UpdateOperationsDocumentInput) => {
      const patch: Record<string, unknown> = {};
      if (input.department !== undefined) patch.department = input.department;
      if (input.name !== undefined) patch.name = input.name;
      if (input.description !== undefined) patch.description = input.description;
      if (input.note !== undefined) patch.note = input.note;
      if (input.external_url !== undefined) patch.external_url = input.external_url;

      if (input.file) {
        // upload new file, remove old if present
        if (input.existing_file_path) {
          await supabase.storage.from("operations-documents").remove([input.existing_file_path]);
        }
        const safeName = `${Date.now()}-${input.file.name}`;
        const path = `${input.category}/${input.department || "misc"}/${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("operations-documents")
          .upload(path, input.file);
        if (upErr) throw upErr;
        patch.file_path = path;
        patch.file_name = input.file.name;
        patch.external_url = null;
      } else if (input.clearFile && input.existing_file_path) {
        await supabase.storage.from("operations-documents").remove([input.existing_file_path]);
        patch.file_path = null;
        patch.file_name = null;
      }

      const { data, error } = await supabase
        .from("operations_documents")
        .update(patch)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as OperationsDocument;
    },
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ["operations-documents", doc.category] });
      toast({ title: "Document updated" });
    },
    onError: (err) => {
      toast({
        title: "Failed to update",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteOperationsDocument = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (doc: OperationsDocument) => {
      if (doc.file_path) {
        await supabase.storage.from("operations-documents").remove([doc.file_path]);
      }
      const { error } = await supabase
        .from("operations_documents")
        .delete()
        .eq("id", doc.id);
      if (error) throw error;
      return doc;
    },
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ["operations-documents", doc.category] });
      toast({ title: "Document deleted" });
    },
    onError: (err) => {
      toast({
        title: "Failed to delete",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    },
  });
};

export const getOperationsDocumentSignedUrl = async (path: string) => {
  const { data, error } = await supabase.storage
    .from("operations-documents")
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
};