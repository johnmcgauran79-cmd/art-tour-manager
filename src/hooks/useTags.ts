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

export interface TaggedContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  state: string | null;
  city: string | null;
  lead_stage: string | null;
  latest_tour_name: string | null;
  latest_tour_end_date: string | null;
}

const CONTACT_FIELDS =
  "id, first_name, last_name, email, phone, state, city, lead_stage, latest_tour_name, latest_tour_end_date";

/** Every contact carrying a given tag. */
export const useTagContacts = (tagId?: string | null) =>
  useQuery({
    queryKey: ["tag-contacts", tagId],
    enabled: !!tagId,
    queryFn: async (): Promise<TaggedContact[]> => {
      const { data, error } = await supabase
        .from("contact_tags")
        .select(`customer:customers(${CONTACT_FIELDS})`)
        .eq("tag_id", tagId as string);
      if (error) throw error;
      return ((data || []) as any[])
        .map((r) => r.customer)
        .filter(Boolean)
        .sort((a: TaggedContact, b: TaggedContact) =>
          `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
        ) as TaggedContact[];
    },
  });

/** Server-side contact search used when adding contacts to a tag. */
export const useTagContactSearch = (term: string) =>
  useQuery({
    queryKey: ["tag-contact-search", term],
    enabled: term.trim().length >= 2,
    queryFn: async (): Promise<TaggedContact[]> => {
      const t = `%${term.trim()}%`;
      const { data, error } = await supabase
        .from("customers")
        .select(CONTACT_FIELDS)
        .or(
          `first_name.ilike.${t},last_name.ilike.${t},preferred_name.ilike.${t},email.ilike.${t}`
        )
        .order("last_name", { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data || []) as TaggedContact[];
    },
  });

/** Apply or remove a tag across many contacts / bookings at once. */
export const useBulkToggleEntityTag = (entity: TagEntity) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      entityIds,
      tagId,
      attach,
    }: { entityIds: string[]; tagId: string; attach: boolean }) => {
      if (!entityIds.length) return 0;
      const col = linkColumn(entity);
      if (attach) {
        const rows = entityIds.map((id) => ({ [col]: id, tag_id: tagId }));
        const { error } = await supabase
          .from(linkTable(entity) as any)
          .upsert(rows as any, { onConflict: `${col},tag_id`, ignoreDuplicates: true });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(linkTable(entity) as any)
          .delete()
          .eq("tag_id", tagId)
          .in(col, entityIds);
        if (error) throw error;
      }
      return entityIds.length;
    },
    onSuccess: (count, vars) => {
      qc.invalidateQueries({ queryKey: ["tag-contacts", vars.tagId] });
      qc.invalidateQueries({ queryKey: ["entity-tags"] });
      qc.invalidateQueries({ queryKey: ["tag-usage"] });
      toast({
        title: vars.attach ? "Tag applied" : "Tag removed",
        description: `${count} ${count === 1 ? "record" : "records"} updated.`,
      });
    },
    onError: (e: any) =>
      toast({ title: "Could not update tags", description: e?.message, variant: "destructive" }),
  });
};

/** Move every contact/booking from one or more tags onto a target tag, then delete the sources. */
export const useMergeTags = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sourceIds, targetId }: { sourceIds: string[]; targetId: string }) => {
      const sources = sourceIds.filter((id) => id !== targetId);
      if (!sources.length) throw new Error("Pick at least one different tag to merge in");

      for (const [table, col] of [
        ["contact_tags", "customer_id"],
        ["booking_tags", "booking_id"],
      ] as const) {
        const { data, error } = await supabase
          .from(table as any)
          .select(col)
          .in("tag_id", sources);
        if (error) throw error;
        const ids = Array.from(new Set(((data || []) as any[]).map((r) => r[col]).filter(Boolean)));
        if (ids.length) {
          const rows = ids.map((id) => ({ [col]: id, tag_id: targetId }));
          const { error: upErr } = await supabase
            .from(table as any)
            .upsert(rows as any, { onConflict: `${col},tag_id`, ignoreDuplicates: true });
          if (upErr) throw upErr;
        }
      }

      const { error: delErr } = await supabase.from("tags").delete().in("id", sources);
      if (delErr) throw delErr;
      return sources.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["tag-usage"] });
      qc.invalidateQueries({ queryKey: ["tag-contacts"] });
      qc.invalidateQueries({ queryKey: ["entity-tags"] });
      toast({ title: `Merged ${count} ${count === 1 ? "tag" : "tags"}` });
    },
    onError: (e: any) =>
      toast({ title: "Could not merge tags", description: e?.message, variant: "destructive" }),
  });
};
