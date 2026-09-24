import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./_supabase";

type FieldValue = string | number | boolean | null;

const ALWAYS_LOCKED = ["id", "created_at", "updated_at", "created_by"];

export const LOCKED_FIELDS: Record<string, string[]> = {
  tours: [...ALWAYS_LOCKED],
  activities: [...ALWAYS_LOCKED, "tour_id", "spots_booked", "spots_remaining", "legacy_status"],
  hotels: [...ALWAYS_LOCKED, "tour_id", "rooms_booked", "legacy_status"],
  customers: [
    ...ALWAYS_LOCKED,
    "brevo_contact_id", "brevo_synced_at", "keap_contact_id", "keap_match_checked_at",
    "lifetime_bookings", "lifetime_value", "latest_tour_name", "latest_tour_end_date",
    "last_activity_at", "original_source", "original_source_at",
    "marketing_consent", "marketing_consent_at", "marketing_consent_source",
  ],
};

const err = (text: string) => ({ content: [{ type: "text" as const, text }], isError: true });

/**
 * Update any editable column on one row. Unknown and locked columns are rejected,
 * never silently dropped. Returns the before/after values of changed fields.
 */
export async function updateRowFields(
  ctx: ToolContext,
  table: "tours" | "activities" | "hotels" | "customers",
  id: string,
  fields: Record<string, FieldValue>,
  opts: { confirmFields?: string[]; confirm?: boolean } = {},
) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return err("No fields supplied.");
  const locked = LOCKED_FIELDS[table];
  const blocked = keys.filter((k) => locked.includes(k));
  if (blocked.length)
    return err(`These fields are locked and can't be changed through AI tools: ${blocked.join(", ")}.`);

  const supabase = supabaseForUser(ctx);
  const { data: row, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  if (error) return err(error.message);
  if (!row) return err(`No ${table} record found with id ${id} (or not permitted).`);
  const current = row as Record<string, unknown>;

  const unknown = keys.filter((k) => !(k in current));
  if (unknown.length) return err(`Unknown field(s) on ${table}: ${unknown.join(", ")}.`);

  const changes = keys
    .filter((k) => current[k] !== fields[k])
    .map((k) => ({ field: k, from: (current[k] ?? null) as FieldValue, to: fields[k] }));
  if (changes.length === 0) {
    const out = { updated: false, changes: [] as typeof changes };
    return { content: [{ type: "text" as const, text: "Nothing changed — values already match." }], structuredContent: out };
  }

  const needsConfirm = changes.filter((c) => opts.confirmFields?.includes(c.field));
  if (needsConfirm.length && !opts.confirm) {
    const out = { updated: false, requires_confirmation: true, changes };
    return {
      content: [{
        type: "text" as const,
        text: `Confirmation required. Show the user these changes (${needsConfirm.map((c) => `${c.field}: "${c.from ?? ""}" → "${c.to ?? ""}"`).join("; ")}) and, only after they agree, call again with confirm=true. Nothing has been saved.`,
      }],
      structuredContent: out,
    };
  }

  const patch = Object.fromEntries(changes.map((c) => [c.field, c.to]));
  const { error: upErr } = await supabase.from(table).update(patch as never).eq("id", id);
  if (upErr) return err(upErr.message);
  const out = { updated: true, changes };
  return { content: [{ type: "text" as const, text: JSON.stringify(out) }], structuredContent: out };
}
