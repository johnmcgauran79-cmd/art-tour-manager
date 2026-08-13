import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TourWelcomeMessage {
  enabled: boolean;
  heading: string;
  body: string;
  signoff: string;
  pickupArrivalMessage: string;
  welcomeDrinksMessage: string;
  /** optional pickup/arrival document (e.g. arrivals map PDF) */
  pickupDocPath: string | null;
  pickupDocName: string | null;
  /** public URL for the pickup/arrival document */
  pickupDocUrl: string | null;
  imagePath: string | null;
  /** signed URL for previewing the stored image */
  imageUrl: string | null;
}

const DEFAULT_HEADING = "Welcome";

export const useTourWelcomeMessage = (tourId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["tour-welcome-message", tourId],
    enabled: !!tourId,
    queryFn: async (): Promise<TourWelcomeMessage> => {
      const { data, error } = await supabase
        .from("tours")
        .select(
          "welcome_message_enabled, welcome_message_heading, welcome_message_body, welcome_message_signoff, welcome_message_image_path, pickup_arrival_message, welcome_drinks_message, pickup_arrival_doc_path, pickup_arrival_doc_name"
        )
        .eq("id", tourId)
        .single();
      if (error) throw error;
      const row = data as any;

      let imageUrl: string | null = null;
      if (row?.welcome_message_image_path) {
        const { data: signed } = await supabase.storage
          .from("attachments")
          .createSignedUrl(row.welcome_message_image_path, 60 * 60);
        imageUrl = signed?.signedUrl ?? null;
      }

      let pickupDocUrl: string | null = null;
      if (row?.pickup_arrival_doc_path) {
        pickupDocUrl = supabase.storage
          .from("email-attachments")
          .getPublicUrl(row.pickup_arrival_doc_path).data.publicUrl;
      }

      return {
        enabled: row?.welcome_message_enabled ?? false,
        heading: row?.welcome_message_heading ?? DEFAULT_HEADING,
        body: row?.welcome_message_body ?? "",
        signoff: row?.welcome_message_signoff ?? "",
        pickupArrivalMessage: row?.pickup_arrival_message ?? "",
        welcomeDrinksMessage: row?.welcome_drinks_message ?? "",
        pickupDocPath: row?.pickup_arrival_doc_path ?? null,
        pickupDocName: row?.pickup_arrival_doc_name ?? null,
        pickupDocUrl,
        imagePath: row?.welcome_message_image_path ?? null,
        imageUrl,
      };
    },
  });

  const update = useMutation({
    mutationFn: async (updates: {
      enabled?: boolean;
      heading?: string;
      body?: string;
      signoff?: string;
      pickupArrivalMessage?: string;
      welcomeDrinksMessage?: string;
      imagePath?: string | null;
    }) => {
      const payload: Record<string, unknown> = {};
      if (updates.enabled !== undefined) payload.welcome_message_enabled = updates.enabled;
      if (updates.heading !== undefined) payload.welcome_message_heading = updates.heading;
      if (updates.body !== undefined) payload.welcome_message_body = updates.body;
      if (updates.signoff !== undefined) payload.welcome_message_signoff = updates.signoff;
      if (updates.pickupArrivalMessage !== undefined)
        payload.pickup_arrival_message = updates.pickupArrivalMessage;
      if (updates.welcomeDrinksMessage !== undefined)
        payload.welcome_drinks_message = updates.welcomeDrinksMessage;
      if (updates.imagePath !== undefined) payload.welcome_message_image_path = updates.imagePath;
      const { error } = await supabase.from("tours").update(payload as any).eq("id", tourId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-welcome-message", tourId] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `welcome-images/${tourId}/${Date.now()}.${ext}`;
      // Remove previous image if present
      const existing = (query.data?.imagePath) || null;
      if (existing) {
        await supabase.storage.from("attachments").remove([existing]);
      }
      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { error } = await supabase
        .from("tours")
        .update({ welcome_message_image_path: filePath } as any)
        .eq("id", tourId);
      if (error) throw error;
      return filePath;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-welcome-message", tourId] });
      toast({ title: "Image uploaded", description: "Welcome message photo updated." });
    },
    onError: (error: any) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const removeImage = useMutation({
    mutationFn: async () => {
      const existing = (query.data?.imagePath) || null;
      if (existing) {
        await supabase.storage.from("attachments").remove([existing]);
      }
      const { error } = await supabase
        .from("tours")
        .update({ welcome_message_image_path: null } as any)
        .eq("id", tourId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-welcome-message", tourId] });
      toast({ title: "Image removed", description: "Welcome message photo removed." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return { ...query, update, uploadImage, removeImage };
};