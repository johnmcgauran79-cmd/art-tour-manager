import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TourDocumentImage {
  id: string;
  filePath: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
  /** signed URL for previewing the stored image */
  imageUrl: string | null;
}

export const MAX_DOCUMENT_IMAGES = 10;

/** Reads an image File's natural dimensions in the browser. */
const readImageDimensions = (file: File): Promise<{ width: number; height: number }> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });

export const useTourDocumentImages = (tourId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["tour-document-images", tourId],
    enabled: !!tourId,
    queryFn: async (): Promise<TourDocumentImage[]> => {
      const { data, error } = await supabase
        .from("tour_document_images")
        .select("id, file_path, caption, width, height, sort_order")
        .eq("tour_id", tourId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;

      const rows = (data as any[]) || [];
      const result: TourDocumentImage[] = [];
      for (const row of rows) {
        let imageUrl: string | null = null;
        if (row.file_path) {
          const { data: signed } = await supabase.storage
            .from("attachments")
            .createSignedUrl(row.file_path, 60 * 60);
          imageUrl = signed?.signedUrl ?? null;
        }
        result.push({
          id: row.id,
          filePath: row.file_path,
          caption: row.caption ?? null,
          width: row.width ?? null,
          height: row.height ?? null,
          sortOrder: row.sort_order ?? 0,
          imageUrl,
        });
      }
      return result;
    },
  });

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      const count = query.data?.length ?? 0;
      if (count >= MAX_DOCUMENT_IMAGES) {
        throw new Error(`You can upload a maximum of ${MAX_DOCUMENT_IMAGES} images.`);
      }
      const dims = await readImageDimensions(file);
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `document-images/${tourId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("tour_document_images").insert({
        tour_id: tourId,
        file_path: filePath,
        width: dims.width || null,
        height: dims.height || null,
        sort_order: count,
        uploaded_by: userData.user?.id ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-document-images", tourId] });
      toast({ title: "Image uploaded", description: "Document image added." });
    },
    onError: (error: any) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const replaceImage = useMutation({
    mutationFn: async ({ image, file }: { image: TourDocumentImage; file: File }) => {
      const dims = await readImageDimensions(file);
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `document-images/${tourId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      if (image.filePath) {
        await supabase.storage.from("attachments").remove([image.filePath]);
      }
      const { error } = await supabase
        .from("tour_document_images")
        .update({ file_path: filePath, width: dims.width || null, height: dims.height || null } as any)
        .eq("id", image.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-document-images", tourId] });
      toast({ title: "Image replaced", description: "Document image updated." });
    },
    onError: (error: any) => {
      toast({ title: "Replace failed", description: error.message, variant: "destructive" });
    },
  });

  const updateCaption = useMutation({
    mutationFn: async ({ id, caption }: { id: string; caption: string }) => {
      const { error } = await supabase
        .from("tour_document_images")
        .update({ caption: caption || null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-document-images", tourId] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeImage = useMutation({
    mutationFn: async (image: TourDocumentImage) => {
      if (image.filePath) {
        await supabase.storage.from("attachments").remove([image.filePath]);
      }
      const { error } = await supabase.from("tour_document_images").delete().eq("id", image.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-document-images", tourId] });
      toast({ title: "Image removed", description: "Document image deleted." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return { ...query, uploadImage, replaceImage, updateCaption, removeImage };
};