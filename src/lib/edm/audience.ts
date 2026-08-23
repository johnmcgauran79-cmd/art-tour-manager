import { supabase } from "@/integrations/supabase/client";

/**
 * Audience filters are stored as JSON on `marketing_audiences` / campaigns and
 * resolved client-side against `customers` so segments always reflect live data.
 */
export interface AudienceFilters {
  states?: string[];
  leadStages?: string[];
  leadSources?: string[];
  /** only contacts who have travelled (latest_tour_name is set) */
  pastTravellersOnly?: boolean;
  /** only contacts who have never travelled */
  neverTravelledOnly?: boolean;
  /** contacts interested in this tour */
  interestedTourId?: string;
  /** latest tour ended before this date (win-back segments) */
  latestTourBefore?: string;
  /** free-text name/email match */
  search?: string;
  /** contacts carrying ALL of these tags */
  tagIds?: string[];
}

/** Resolve the customer ids that carry every one of the given tags. */
const customerIdsForTags = async (tagIds: string[]): Promise<string[]> => {
  const { data, error } = await supabase
    .from("contact_tags")
    .select("customer_id, tag_id")
    .in("tag_id", tagIds);
  if (error) throw error;
  const counts = new Map<string, Set<string>>();
  (data || []).forEach((r: any) => {
    const set = counts.get(r.customer_id) || new Set<string>();
    set.add(r.tag_id);
    counts.set(r.customer_id, set);
  });
  return [...counts.entries()]
    .filter(([, set]) => set.size === new Set(tagIds).size)
    .map(([id]) => id);
};


export interface AudienceContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  state: string | null;
  lead_stage: string | null;
  latest_tour_name: string | null;
}

const PAGE = 1000;

const applyFilters = (query: any, f: AudienceFilters, tagCustomerIds?: string[] | null) => {
  let q = query
    .not("email", "is", null)
    .neq("email", "")
    .eq("marketing_consent", true);

  if (tagCustomerIds) q = q.in("id", tagCustomerIds.length ? tagCustomerIds : [""]);
  if (f.states?.length) q = q.in("state", f.states);
  if (f.leadStages?.length) q = q.in("lead_stage", f.leadStages);
  if (f.leadSources?.length) q = q.in("lead_source", f.leadSources);
  if (f.pastTravellersOnly) q = q.not("latest_tour_name", "is", null);
  if (f.neverTravelledOnly) q = q.is("latest_tour_name", null);
  if (f.interestedTourId) q = q.eq("interested_tour_id", f.interestedTourId);
  if (f.latestTourBefore) q = q.lt("latest_tour_end_date", f.latestTourBefore);
  if (f.search) {
    const s = f.search.replace(/[%,]/g, "");
    q = q.or(
      `first_name.ilike.%${s}%,last_name.ilike.%${s}%,email.ilike.%${s}%`
    );
  }
  return q;
};

/** Count matching, consented contacts without fetching them all. */
export const countAudience = async (filters: AudienceFilters): Promise<number> => {
  const tagIds = filters.tagIds?.length ? await customerIdsForTags(filters.tagIds) : null;
  const { count, error } = await applyFilters(
    supabase.from("customers").select("id", { count: "exact", head: true }),
    filters,
    tagIds
  );
  if (error) throw error;
  return count || 0;
};

/** Resolve the full recipient list (paged past the 1000-row API limit). */
export const resolveAudience = async (
  filters: AudienceFilters
): Promise<AudienceContact[]> => {
  const out: AudienceContact[] = [];
  const tagIds = filters.tagIds?.length ? await customerIdsForTags(filters.tagIds) : null;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await applyFilters(
      supabase
        .from("customers")
        .select("id, first_name, last_name, email, state, lead_stage, latest_tour_name"),
      filters,
      tagIds
    )
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data || []) as AudienceContact[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }


  // De-dupe by lowercase email — one send per address.
  const seen = new Set<string>();
  return out.filter((c) => {
    const key = (c.email || "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const describeFilters = (f: AudienceFilters): string => {
  const parts: string[] = [];
  if (f.states?.length) parts.push(`State: ${f.states.join(", ")}`);
  if (f.leadStages?.length) parts.push(`Lead stage: ${f.leadStages.join(", ")}`);
  if (f.leadSources?.length) parts.push(`Source: ${f.leadSources.join(", ")}`);
  if (f.pastTravellersOnly) parts.push("Past travellers");
  if (f.neverTravelledOnly) parts.push("Never travelled");
  if (f.interestedTourId) parts.push("Interested in a specific tour");
  if (f.latestTourBefore) parts.push(`Last travelled before ${f.latestTourBefore}`);
  if (f.tagIds?.length) parts.push(`Tags: ${f.tagIds.length} selected`);
  if (f.search) parts.push(`Matching "${f.search}"`);

  return parts.length ? parts.join(" · ") : "All consented contacts";
};

export const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

export const LEAD_STAGES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];
