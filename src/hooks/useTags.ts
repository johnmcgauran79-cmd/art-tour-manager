import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Tag {
  id: string;
  name: string;
  category: string | null;
  color: string;
  created_at: string;
}

export type TagEntity = "contact" | "booking";

const linkTable = (entity: TagEntity) =>
  entity === "contact" ? "contact_tags" : "booking_tags";
const linkColumn = (entity: TagEntity) =>
  entity === "contact" ? "customer_id" : "booking_id";

/** Suggested groupings so tags stay tidy (free text is still allowed). */
export const TAG_CATEGORIES = ["Interest", "Segment", "Audience", "Operations"];

/** All tags in the system, alphabetical. */
export const useTags = () =>
  useQuery({
    queryKey: ["tags"],
    queryFn: async (): Promise<Tag[]> => {
      const { data, error } = await supabase
        .from("tags")
        .select("id, name, category, color, created_at")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as Tag[];
    },
    staleTime: 60_000,
  });

export const useCreateTag = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; category?: string | null; color?: string }) => {
      const name = input.name.trim();
      if (!name) throw new Error("Tag name is required");
      const { data, error } = await supabase
        .from("tags")
        .insert({
          name,
          category: input.category || null,
          ...(input.color ? { color: input.color } : {}),
        })
        .select("id, name, category, color, created_at")
        .single();
      if (error) throw error;
      return data as Tag;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
    onError: (e: any) =>
      toast({
        title: "Could not create tag",
        description: e?.message?.includes("duplicate")
          ? "A tag with that name already exists."
          : e?.message,
        variant: "destructive",
      }),
  });
};

export const useUpdateTag = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; category?: string | null; color?: string }) => {
      const { error } = await supabase.from("tags").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["entity-tags"] });
    },
    onError: (e: any) =>
      toast({ title: "Could not update tag", description: e?.message, variant: "destructive" }),
  });
};

export const useDeleteTag = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["entity-tags"] });
      toast({ title: "Tag deleted" });
    },
    onError: (e: any) =>
      toast({ title: "Could not delete tag", description: e?.message, variant: "destructive" }),
  });
};

/** Tags applied to a single contact or booking. */
export const useEntityTags = (entity: TagEntity, entityId?: string | null) =>
  useQuery({
    queryKey: ["entity-tags", entity, entityId],
    enabled: !!entityId,
    queryFn: async (): Promise<Tag[]> => {
      const { data, error } = await supabase
        .from(linkTable(entity) as any)
        .select("tag:tags(id, name, category, color, created_at)")
        .eq(linkColumn(entity), entityId as string);
      if (error) throw error;
      return ((data || []) as any[])
        .map((r) => r.tag)
        .filter(Boolean)
        .sort((a: Tag, b: Tag) => a.name.localeCompare(b.name)) as Tag[];
    },
  });

export const useToggleEntityTag = (entity: TagEntity) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      entityId,
      tagId,
      attach,
    }: { entityId: string; tagId: string; attach: boolean }) => {
      if (attach) {
        const { error } = await supabase
          .from(linkTable(entity) as any)
          .insert({ [linkColumn(entity)]: entityId, tag_id: tagId } as any);
        if (error && !error.message.includes("duplicate")) throw error;
      } else {
        const { error } = await supabase
          .from(linkTable(entity) as any)
          .delete()
          .eq(linkColumn(entity), entityId)
          .eq("tag_id", tagId);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["entity-tags", entity, vars.entityId] });
      qc.invalidateQueries({ queryKey: ["tag-usage"] });
    },
    onError: (e: any) =>
      toast({ title: "Could not update tags", description: e?.message, variant: "destructive" }),
  });
};

/** How many contacts / bookings each tag is applied to. */
export const useTagUsage = () =>
  useQuery({
    queryKey: ["tag-usage"],
    queryFn: async () => {
      const [contacts, bookings] = await Promise.all([
        supabase.from("contact_tags").select("tag_id"),
        supabase.from("booking_tags").select("tag_id"),
      ]);
      if (contacts.error) throw contacts.error;
      if (bookings.error) throw bookings.error;
      const usage: Record<string, { contacts: number; bookings: number }> = {};
      const bump = (id: string, key: "contacts" | "bookings") => {
        usage[id] = usage[id] || { contacts: 0, bookings: 0 };
        usage[id][key] += 1;
      };
      (contacts.data || []).forEach((r: any) => bump(r.tag_id, "contacts"));
      (bookings.data || []).forEach((r: any) => bump(r.tag_id, "bookings"));
      return usage;
    },
  });
