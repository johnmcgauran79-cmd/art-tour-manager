import { supabase } from "@/integrations/supabase/client";

/**
 * Hierarchical audience rule tree.
 *
 * A group combines children with AND or OR and can be negated (NOT), which
 * makes expressions like  (NSW OR VIC) AND tagged "Ladies" AND NOT (travelled
 * in the last 6 months)  expressible from the UI.
 *
 * Rules are evaluated client-side against the consented contact set so a single
 * fetch can answer arbitrarily complex logic (~6.6k contacts today).
 */

export type RuleField =
  | "state"
  | "country"
  | "lead_stage"
  | "lead_source"
  | "tag"
  | "interested_tour"
  | "latest_tour_end_date"
  | "has_travelled"
  | "created_at"
  | "last_opened"
  | "last_clicked"
  | "name_email";

export type RuleOperator =
  | "in" // value: string[]
  | "eq" // value: string
  | "contains" // value: string
  | "before" // value: yyyy-MM-dd
  | "after" // value: yyyy-MM-dd
  | "within_days" // value: number
  | "not_within_days" // value: number
  | "never"
  | "is_true"
  | "is_false";

export interface AudienceRule {
  id: string;
  kind: "rule";
  field: RuleField;
  operator: RuleOperator;
  value?: string | string[] | number | null;
  /** invert this single rule */
  negate?: boolean;
}

export interface AudienceGroup {
  id: string;
  kind: "group";
  combinator: "and" | "or";
  /** invert the whole group */
  negate?: boolean;
  children: AudienceNode[];
}

export type AudienceNode = AudienceRule | AudienceGroup;

export const newId = () => Math.random().toString(36).slice(2, 10);

export const emptyGroup = (combinator: "and" | "or" = "and"): AudienceGroup => ({
  id: newId(),
  kind: "group",
  combinator,
  children: [],
});

export const defaultRule = (): AudienceRule => ({
  id: newId(),
  kind: "rule",
  field: "state",
  operator: "in",
  value: [],
});

export const FIELD_META: Record<
  RuleField,
  { label: string; group: string; operators: RuleOperator[] }
> = {
  state: { label: "State", group: "Location", operators: ["in"] },
  country: { label: "Country", group: "Location", operators: ["eq", "contains"] },
  lead_stage: { label: "Lead stage", group: "Status", operators: ["in"] },
  lead_source: { label: "Lead source", group: "Status", operators: ["in", "contains"] },
  tag: { label: "Tag", group: "Tags", operators: ["in"] },
  interested_tour: { label: "Interested tour", group: "Tours", operators: ["eq"] },
  latest_tour_end_date: {
    label: "Last tour ended",
    group: "Tours",
    operators: ["before", "after", "not_within_days", "within_days"],
  },
  has_travelled: { label: "Has travelled", group: "Tours", operators: ["is_true", "is_false"] },
  created_at: { label: "Contact created", group: "Status", operators: ["before", "after", "within_days"] },
  last_opened: {
    label: "Opened an email",
    group: "Engagement",
    operators: ["within_days", "not_within_days", "never"],
  },
  last_clicked: {
    label: "Clicked an email",
    group: "Engagement",
    operators: ["within_days", "not_within_days", "never"],
  },
  name_email: { label: "Name or email", group: "Other", operators: ["contains"] },
};

export const OPERATOR_LABELS: Record<RuleOperator, string> = {
  in: "is any of",
  eq: "is",
  contains: "contains",
  before: "before",
  after: "after",
  within_days: "in the last (days)",
  not_within_days: "not in the last (days)",
  never: "never",
  is_true: "yes",
  is_false: "no",
};

export interface RuleContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  state: string | null;
  country: string | null;
  lead_stage: string | null;
  lead_source: string | null;
  latest_tour_name: string | null;
  latest_tour_end_date: string | null;
  interested_tour_id: string | null;
  created_at: string | null;
}

export interface RuleContext {
  /** customer_id -> set of tag ids */
  tags: Map<string, Set<string>>;
  /** lowercase email -> latest open timestamp (ms) */
  opens: Map<string, number>;
  /** lowercase email -> latest click timestamp (ms) */
  clicks: Map<string, number>;
}

const daysAgoMs = (days: number) => Date.now() - days * 86_400_000;

const asArray = (v: AudienceRule["value"]): string[] =>
  Array.isArray(v) ? v.map(String) : v === undefined || v === null || v === "" ? [] : [String(v)];

const dateMs = (v?: string | null) => (v ? new Date(v).getTime() : NaN);

const evalEngagement = (
  ts: number | undefined,
  operator: RuleOperator,
  value: AudienceRule["value"]
): boolean => {
  const days = Number(value) || 0;
  if (operator === "never") return ts === undefined;
  if (operator === "within_days") return ts !== undefined && ts >= daysAgoMs(days);
  if (operator === "not_within_days") return ts === undefined || ts < daysAgoMs(days);
  return true;
};

const evalRule = (rule: AudienceRule, c: RuleContact, ctx: RuleContext): boolean => {
  const email = (c.email || "").trim().toLowerCase();
  let result = true;

  switch (rule.field) {
    case "state": {
      const list = asArray(rule.value);
      result = !list.length || list.includes(c.state || "");
      break;
    }
    case "country":
      result =
        rule.operator === "contains"
          ? (c.country || "").toLowerCase().includes(String(rule.value || "").toLowerCase())
          : (c.country || "") === String(rule.value || "");
      break;
    case "lead_stage": {
      const list = asArray(rule.value);
      result = !list.length || list.includes(c.lead_stage || "");
      break;
    }
    case "lead_source": {
      if (rule.operator === "contains") {
        result = (c.lead_source || "").toLowerCase().includes(String(rule.value || "").toLowerCase());
      } else {
        const list = asArray(rule.value);
        result = !list.length || list.includes(c.lead_source || "");
      }
      break;
    }
    case "tag": {
      const list = asArray(rule.value);
      const owned = ctx.tags.get(c.id);
      result = !list.length || list.some((t) => owned?.has(t));
      break;
    }
    case "interested_tour":
      result = (c.interested_tour_id || "") === String(rule.value || "");
      break;
    case "latest_tour_end_date": {
      const ts = dateMs(c.latest_tour_end_date);
      if (rule.operator === "before") result = !Number.isNaN(ts) && ts < dateMs(String(rule.value));
      else if (rule.operator === "after") result = !Number.isNaN(ts) && ts > dateMs(String(rule.value));
      else if (rule.operator === "within_days")
        result = !Number.isNaN(ts) && ts >= daysAgoMs(Number(rule.value) || 0);
      else result = Number.isNaN(ts) || ts < daysAgoMs(Number(rule.value) || 0);
      break;
    }
    case "has_travelled":
      result = rule.operator === "is_true" ? !!c.latest_tour_name : !c.latest_tour_name;
      break;
    case "created_at": {
      const ts = dateMs(c.created_at);
      if (rule.operator === "before") result = !Number.isNaN(ts) && ts < dateMs(String(rule.value));
      else if (rule.operator === "after") result = !Number.isNaN(ts) && ts > dateMs(String(rule.value));
      else result = !Number.isNaN(ts) && ts >= daysAgoMs(Number(rule.value) || 0);
      break;
    }
    case "last_opened":
      result = evalEngagement(ctx.opens.get(email), rule.operator, rule.value);
      break;
    case "last_clicked":
      result = evalEngagement(ctx.clicks.get(email), rule.operator, rule.value);
      break;
    case "name_email": {
      const needle = String(rule.value || "").toLowerCase();
      const hay = `${c.first_name || ""} ${c.last_name || ""} ${c.email || ""}`.toLowerCase();
      result = !needle || hay.includes(needle);
      break;
    }
  }

  return rule.negate ? !result : result;
};

export const evalNode = (node: AudienceNode, c: RuleContact, ctx: RuleContext): boolean => {
  if (node.kind === "rule") return evalRule(node, c, ctx);
  const kids = node.children || [];
  if (!kids.length) return true;
  const value =
    node.combinator === "and"
      ? kids.every((k) => evalNode(k, c, ctx))
      : kids.some((k) => evalNode(k, c, ctx));
  return node.negate ? !value : value;
};

/** Collect every field used in the tree so we only fetch the data we need. */
export const usedFields = (node: AudienceNode, out = new Set<RuleField>()): Set<RuleField> => {
  if (node.kind === "rule") out.add(node.field);
  else (node.children || []).forEach((k) => usedFields(k, out));
  return out;
};

const PAGE = 1000;

/** All consented, emailable contacts (paged past the 1000-row API limit). */
export const fetchConsentedContacts = async (): Promise<RuleContact[]> => {
  const out: RuleContact[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("customers")
      .select(
        "id, first_name, last_name, email, state, country, lead_stage, lead_source, latest_tour_name, latest_tour_end_date, interested_tour_id, created_at"
      )
      .not("email", "is", null)
      .neq("email", "")
      .eq("marketing_consent", true)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data || []) as RuleContact[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
};

const fetchTagMap = async (): Promise<Map<string, Set<string>>> => {
  const map = new Map<string, Set<string>>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("contact_tags")
      .select("customer_id, tag_id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    (data || []).forEach((r: any) => {
      const set = map.get(r.customer_id) || new Set<string>();
      set.add(r.tag_id);
      map.set(r.customer_id, set);
    });
    if ((data || []).length < PAGE) break;
  }
  return map;
};

const fetchEngagement = async () => {
  const opens = new Map<string, number>();
  const clicks = new Map<string, number>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("campaign_events")
      .select("email, event_type, created_at")
      .in("event_type", ["open", "opened", "click", "clicked"])
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    (data || []).forEach((r: any) => {
      const key = (r.email || "").trim().toLowerCase();
      if (!key) return;
      const ts = new Date(r.created_at).getTime();
      const target = r.event_type.startsWith("click") ? clicks : opens;
      if (!target.has(key) || ts > (target.get(key) as number)) target.set(key, ts);
    });
    if ((data || []).length < PAGE) break;
  }
  return { opens, clicks };
};

export const buildRuleContext = async (root: AudienceNode): Promise<RuleContext> => {
  const fields = usedFields(root);
  const needTags = fields.has("tag");
  const needEngagement = fields.has("last_opened") || fields.has("last_clicked");
  const [tags, engagement] = await Promise.all([
    needTags ? fetchTagMap() : Promise.resolve(new Map<string, Set<string>>()),
    needEngagement ? fetchEngagement() : Promise.resolve({ opens: new Map(), clicks: new Map() }),
  ]);
  return { tags, opens: engagement.opens, clicks: engagement.clicks };
};

/** Resolve a rule tree to the matching consented contacts (de-duped by email). */
export const resolveRuleTree = async (root: AudienceGroup): Promise<RuleContact[]> => {
  const [contacts, ctx] = await Promise.all([fetchConsentedContacts(), buildRuleContext(root)]);
  const seen = new Set<string>();
  return contacts.filter((c) => {
    const key = (c.email || "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    if (!evalNode(root, c, ctx)) return false;
    seen.add(key);
    return true;
  });
};

const ruleLabel = (
  rule: AudienceRule,
  lookup: { tags?: Record<string, string>; tours?: Record<string, string> } = {}
): string => {
  const meta = FIELD_META[rule.field];
  const not = rule.negate ? "NOT " : "";
  const values = asArray(rule.value)
    .map((v) =>
      rule.field === "tag"
        ? lookup.tags?.[v] || "tag"
        : rule.field === "interested_tour"
          ? lookup.tours?.[v] || "tour"
          : v
    )
    .join(", ");

  if (rule.operator === "never") return `${not}${meta.label}: never`;
  if (rule.operator === "is_true") return `${not}${meta.label}: yes`;
  if (rule.operator === "is_false") return `${not}${meta.label}: no`;
  return `${not}${meta.label} ${OPERATOR_LABELS[rule.operator]} ${values || (rule.value ?? "")}`.trim();
};

export const describeNode = (
  node: AudienceNode,
  lookup: { tags?: Record<string, string>; tours?: Record<string, string> } = {},
  depth = 0
): string => {
  if (node.kind === "rule") return ruleLabel(node, lookup);
  const kids = (node.children || []).map((k) => describeNode(k, lookup, depth + 1)).filter(Boolean);
  if (!kids.length) return "";
  const joined = kids.join(node.combinator === "and" ? " AND " : " OR ");
  const wrapped = depth > 0 && kids.length > 1 ? `(${joined})` : joined;
  return node.negate ? `NOT ${kids.length > 1 ? `(${joined})` : joined}` : wrapped;
};

export const countRules = (node: AudienceNode): number =>
  node.kind === "rule" ? 1 : (node.children || []).reduce((n, k) => n + countRules(k), 0);
