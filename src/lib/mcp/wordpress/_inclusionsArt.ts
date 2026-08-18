import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../tools/_supabase";
import { sanitiseInlineHtml, type ArtInclusionItem, type InclusionKind } from "./inclusions";

export interface ArtInclusionsLoad {
  tour: { id: string; name: string | null };
  items: ArtInclusionItem[];
  inclusions: string[];
  exclusions: string[];
  website_description: string;
}

/** Load a tour's inclusion/exclusion items plus its website description block. */
export async function loadArtInclusions(
  ctx: ToolContext,
  tourId: string,
): Promise<{ error: string } | ArtInclusionsLoad> {
  const supabase = supabaseForUser(ctx);

  const { data: tour, error: tourError } = await supabase
    .from("tours")
    .select("id, name, website_description")
    .eq("id", tourId)
    .maybeSingle();
  if (tourError) return { error: tourError.message };
  if (!tour) return { error: `No tour found with id ${tourId}.` };

  const { data: items, error: itemsError } = await supabase
    .from("tour_inclusion_items")
    .select("id, kind, content_html, sort_order")
    .eq("tour_id", tourId)
    .order("sort_order", { ascending: true });
  if (itemsError) return { error: itemsError.message };

  const rows = (items ?? []) as ArtInclusionItem[];
  const pick = (kind: InclusionKind) =>
    rows
      .filter((r) => r.kind === kind)
      .map((r) => sanitiseInlineHtml(r.content_html))
      .filter((s) => s.length > 0);

  return {
    tour: { id: tour.id as string, name: (tour.name as string | null) ?? null },
    items: rows,
    inclusions: pick("inclusion"),
    exclusions: pick("exclusion"),
    website_description: ((tour as { website_description?: string | null }).website_description) ?? "",
  };
}
