import { supabase } from "@/integrations/supabase/client";
import {
  countRules,
  describeNode,
  resolveRuleTree,
  type AudienceGroup,
} from "./audienceRules";

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
  /** contacts carrying ALL of these tags (or ANY when tagMatchAny is set) */
  tagIds?: string[];
  /** match contacts carrying ANY of the selected tags instead of all of them */
  tagMatchAny?: boolean;
  /**
   * Explicit list of email addresses to send to. When present it takes
   * precedence over every other filter — contacts are matched by email so
   * merge fields still work, and unknown addresses are sent to as-is.
   */
  emails?: string[];
  /**
   * Advanced rule tree (nested AND/OR/NOT). When present it takes precedence
   * over the simple filters above and is evaluated client-side.
   */
  rules?: AudienceGroup;
}

/** Parse a pasted blob of addresses into a clean, de-duped list. */
export const parseEmailList = (raw: string): string[] => {
  const found = raw
    .split(/[\s,;<>()"']+/)
    .map((s) => s.trim().replace(/[.,;:]+$/, "").toLowerCase())
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
  return Array.from(new Set(found));
};


/** True when the audience uses the advanced rule tree. */
export const hasRules = (f: AudienceFilters): boolean =>
  !!f.rules && countRules(f.rules) > 0;

/** Resolve the customer ids that carry the given tags (all by default). */
const customerIdsForTags = async (tagIds: string[], any = false): Promise<string[]> => {
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
    .filter(([, set]) => any || set.size === new Set(tagIds).size)
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

/**
 * Resolve an explicit list of addresses into contacts, matching each address to
 * a customer record where one exists so merge fields still personalise.
 */
export const resolveEmailList = async (emails: string[]): Promise<AudienceContact[]> => {
  const clean = Array.from(
    new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))
  );
  if (!clean.length) return [];

  const matched = new Map<string, AudienceContact>();
  for (let i = 0; i < clean.length; i += 200) {
    const chunk = clean.slice(i, i + 200);
    const { data, error } = await supabase
      .from("customers")
      .select("id, first_name, last_name, email, state, lead_stage, latest_tour_name")
      .in("email", chunk);
    if (error) throw error;
    (data || []).forEach((c: any) => {
      const key = (c.email || "").trim().toLowerCase();
      if (key && !matched.has(key)) matched.set(key, c as AudienceContact);
    });
  }

  return clean.map(
    (email) =>
      matched.get(email) || {
        id: "",
        first_name: null,
        last_name: null,
        email,
        state: null,
        lead_stage: null,
        latest_tour_name: null,
      }
  );
};

/** Count matching, consented contacts without fetching them all. */
export const countAudience = async (filters: AudienceFilters): Promise<number> => {
  if (filters.emails?.length) return (await resolveEmailList(filters.emails)).length;
  if (hasRules(filters)) return (await resolveRuleTree(filters.rules as AudienceGroup)).length;
  const tagIds = filters.tagIds?.length
    ? await customerIdsForTags(filters.tagIds, filters.tagMatchAny)
    : null;
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
  if (filters.emails?.length) return resolveEmailList(filters.emails);
  if (hasRules(filters)) {
    const rows = await resolveRuleTree(filters.rules as AudienceGroup);
    return rows.map((r) => ({
      id: r.id,

      first_name: r.first_name,
      last_name: r.last_name,
      email: r.email,
      state: r.state,
      lead_stage: r.lead_stage,
      latest_tour_name: r.latest_tour_name,
    }));
  }
  const tagIds = filters.tagIds?.length
    ? await customerIdsForTags(filters.tagIds, filters.tagMatchAny)
    : null;
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

export const describeFilters = (
  f: AudienceFilters,
  lookup: { tags?: Record<string, string>; tours?: Record<string, string> } = {}
): string => {
  if (hasRules(f)) return describeNode(f.rules as AudienceGroup, lookup) || "All consented contacts";
  const parts: string[] = [];
  if (f.states?.length) parts.push(`State: ${f.states.join(", ")}`);
  if (f.leadStages?.length) parts.push(`Lead stage: ${f.leadStages.join(", ")}`);
  if (f.leadSources?.length) parts.push(`Source: ${f.leadSources.join(", ")}`);
  if (f.pastTravellersOnly) parts.push("Past travellers");
  if (f.neverTravelledOnly) parts.push("Never travelled");
  if (f.interestedTourId) parts.push("Interested in a specific tour");
  if (f.latestTourBefore) parts.push(`Last travelled before ${f.latestTourBefore}`);
  if (f.tagIds?.length)
    parts.push(
      `Tags (${f.tagMatchAny ? "any" : "all"}): ${f.tagIds
        .map((id) => lookup.tags?.[id] || "tag")
        .join(", ")}`
    );
  if (f.search) parts.push(`Matching "${f.search}"`);

  return parts.length ? parts.join(" · ") : "All consented contacts";
};

export { AU_STATE_CODES as AU_STATES } from "@/lib/auStates";

export const LEAD_STAGES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];
