import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const MAX_DAY_PHOTOS = 3;

export interface ItineraryDayImage {
  id: string;
  dayId: string;
  filePath: string;
  fileName: string | null;
  caption: string | null;
  sortOrder: number;
  /** WordPress media id once the photo has been published to the website gallery */
  wpMediaId: number | null;
  /** signed URL for previewing the stored image */
  imageUrl: string | null;
}

/** Photos (max 3) attached to a single itinerary day. */
export const useItineraryDayImages = (dayId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = ["itinerary-day-images", dayId];

  const query = useQuery({
    queryKey,
    enabled: !!dayId,
    queryFn: async (): Promise<ItineraryDayImage[]> => {
      const { data, error } = await supabase
        .from("tour_itinerary_day_images")
        .select("id, day_id, file_path, file_name, caption, sort_order, wp_media_id")
        .eq("day_id", dayId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;

      const result: ItineraryDayImage[] = [];
      for (const row of data ?? []) {
        let imageUrl: string | null = null;
        if (row.file_path) {
          const { data: signed } = await supabase.storage
            .from("attachments")
            .createSignedUrl(row.file_path, 60 * 60);
          imageUrl = signed?.signedUrl ?? null;
        }
        result.push({
          id: row.id,
          dayId: row.day_id,
          filePath: row.file_path,
          fileName: row.file_name ?? null,
          caption: row.caption ?? null,
          sortOrder: row.sort_order ?? 0,
          wpMediaId: row.wp_media_id ?? null,
          imageUrl,
        });
      }
      return result;
    },
  });

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      const count = query.data?.length ?? 0;
      if (count >= MAX_DAY_PHOTOS) {
        throw new Error(`You can upload a maximum of ${MAX_DAY_PHOTOS} photos per day.`);
      }
      if (!file.type.startsWith("image/")) {
        throw new Error("Please choose an image file (JPEG, PNG, WEBP or GIF).");
      }
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `itinerary-day-photos/${dayId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("tour_itinerary_day_images").insert({
        day_id: dayId,
        file_path: filePath,
        file_name: file.name,
        sort_order: count,
        uploaded_by: userData.user?.id ?? null,
      } as any);
      if (error) {
        await supabase.storage.from("attachments").remove([filePath]);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Photo added", description: "Itinerary day photo uploaded." });
    },
    onError: (error: any) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  /** Swap the stored file for a resized/cropped version, keeping caption and order. */
  const replaceImage = useMutation({
    mutationFn: async ({ image, file }: { image: ItineraryDayImage; file: File }) => {
      if (!file.type.startsWith("image/")) {
        throw new Error("Please choose an image file (JPEG, PNG, WEBP or GIF).");
      }
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `itinerary-day-photos/${dayId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { error } = await supabase
        .from("tour_itinerary_day_images")
        .update({
          file_path: filePath,
          file_name: file.name,
          // reset website linkage so the next sync publishes the resized version
          wp_media_id: null,
          wp_source_url: null,
        } as any)
        .eq("id", image.id);
      if (error) {
        await supabase.storage.from("attachments").remove([filePath]);
        throw error;
      }
      if (image.filePath) {
        await supabase.storage.from("attachments").remove([image.filePath]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: "Photo updated",
        description: "The resized photo will publish on the next itinerary photo sync.",
      });
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const updateCaption = useMutation({

    mutationFn: async ({ id, caption }: { id: string; caption: string }) => {
      const { error } = await supabase
        .from("tour_itinerary_day_images")
        .update({ caption: caption || null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeImage = useMutation({
    mutationFn: async (image: ItineraryDayImage) => {
      const { error } = await supabase
        .from("tour_itinerary_day_images")
        .delete()
        .eq("id", image.id);
      if (error) throw error;
      if (image.filePath) {
        await supabase.storage.from("attachments").remove([image.filePath]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: "Photo removed",
        description: "It will drop off the website gallery on the next itinerary photo sync.",
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return { ...query, uploadImage, updateCaption, removeImage };
};
