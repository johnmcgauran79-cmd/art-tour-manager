import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, RefreshCcw, Save, Search, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { ART_SOURCES, ART_SOURCE_GROUPS, suggestArtSource, type ArtSource } from "@/lib/mcp/wordpress/artSources";

type DbMapping = {
  id?: string;
  wp_field_key: string;
  wp_group: string;
  wp_label: string | null;
  wp_kind: string;
  art_source: string | null;
  enabled: boolean;
  notes: string | null;
};

type DiscoveredField = {
  wp_field_key: string;
  kind: string;
  sample: string;
  group: "headline" | "hotel" | "itinerary" | "repeater" | "other";
};

type Row = DbMapping & { sample?: string; discovered?: boolean; dirty?: boolean };

const UNMAPPED = "__unmapped__";

function useCallProxy() {
  return async <T,>(body: Record<string, unknown>): Promise<T> => {
    const { data, error } = await supabase.functions.invoke("wp-content-proxy", { body });
    if (error) throw new Error(error.message);
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    return data as T;
  };
}

export function WordpressFieldMappingSection() {
  const call = useCallProxy();
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [sampleTourId, setSampleTourId] = useState<number | null>(null);
  const [filter, setFilter] = useState("");

  async function loadMappings() {
    setLoading(true);
    try {
      const res = await call<{ mappings: DbMapping[] }>({ op: "list_field_mappings" });
      setRows((res.mappings ?? []).map((m) => ({ ...m })));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function discoverFields() {
    setDiscovering(true);
    try {
      const res = await call<{ wp_tour_id: number; fields: DiscoveredField[] }>({ op: "discover_wp_fields" });
      setSampleTourId(res.wp_tour_id);
      setRows((prev) => {
        const byKey = new Map(prev.map((r) => [r.wp_field_key, r] as const));
        const merged: Row[] = [];
        for (const f of res.fields) {
          const existing = byKey.get(f.wp_field_key);
          if (existing) {
            merged.push({ ...existing, sample: f.sample, discovered: true, wp_group: existing.wp_group || f.group });
            byKey.delete(f.wp_field_key);
          } else {
            merged.push({
              wp_field_key: f.wp_field_key,
              wp_group: f.group,
              wp_label: null,
              wp_kind: f.kind === "repeater" ? "repeater" : (f.kind === "number" ? "number" : "text"),
              art_source: suggestArtSource(f.wp_field_key),
              enabled: true,
              notes: null,
              sample: f.sample,
              discovered: true,
              dirty: true,
            });
          }
        }
        // Preserve any DB mappings that weren't in the discovered set
        for (const leftover of byKey.values()) merged.push(leftover);
        return merged;
      });
      toast.success(`Discovered ${res.fields.length} fields on WP tour #${res.wp_tour_id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDiscovering(false);
    }
  }

  async function saveAll() {
    const dirty = rows.filter((r) => r.dirty);
    if (dirty.length === 0) {
      toast.info("No changes to save");
      return;
    }
    setSaving(true);
    try {
      await call({
        op: "save_field_mappings",
        mappings: dirty.map((r) => ({
          wp_field_key: r.wp_field_key,
          wp_group: r.wp_group,
          wp_label: r.wp_label,
          wp_kind: r.wp_kind,
          art_source: r.art_source,
          enabled: r.enabled,
          notes: r.notes,
        })),
      });
      toast.success(`Saved ${dirty.length} mapping${dirty.length === 1 ? "" : "s"}`);
      setRows((prev) => prev.map((r) => ({ ...r, dirty: false })));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function autoSuggestAll() {
    setRows((prev) =>
      prev.map((r) => {
        if (r.art_source) return r;
        const s = suggestArtSource(r.wp_field_key);
        if (!s) return r;
        return { ...r, art_source: s, dirty: true };
      }),
    );
    toast.info("Applied auto-suggestions to unmapped fields");
  }

  useEffect(() => { void loadMappings(); }, []);

  const grouped = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => r.wp_field_key.toLowerCase().includes(q) || (r.wp_label ?? "").toLowerCase().includes(q))
      : rows;
    const map = new Map<string, Row[]>();
    for (const r of filtered) {
      const g = r.wp_group || "other";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(r);
    }
    const order = ["headline", "hotel", "itinerary", "repeater", "other"];
    return Array.from(map.entries()).sort((a, b) => {
      const ai = order.indexOf(a[0]); const bi = order.indexOf(b[0]);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [rows, filter]);

  const dirtyCount = rows.filter((r) => r.dirty).length;

  function update(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.wp_field_key === key ? { ...r, ...patch, dirty: true } : r)));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
        <div>
          <CardTitle>WordPress ↔ ART field mappings</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Global mapping — one setting applies to every linked tour. Discover pulls the current ACF field list from a sample WordPress tour; unrecognised fields appear here so you can pick which ART field feeds them.
            {sampleTourId ? <> Discovered from WP tour <Badge variant="secondary" className="ml-1">#{sampleTourId}</Badge>.</> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void loadMappings()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
            Reload
          </Button>
          <Button size="sm" variant="outline" onClick={() => void discoverFields()} disabled={discovering}>
            {discovering ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Discover from WP
          </Button>
          <Button size="sm" variant="outline" onClick={autoSuggestAll}>
            <Wand2 className="h-4 w-4 mr-2" /> Auto-suggest
          </Button>
          <Button size="sm" onClick={() => void saveAll()} disabled={saving || dirtyCount === 0}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Input placeholder="Filter fields…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading mappings…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No mappings yet. Click <strong>Discover from WP</strong> to pull the current ACF field list.
          </div>
        ) : (
          grouped.map(([group, groupRows]) => (
            <div key={group}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group}</h3>
                <Badge variant="outline">{groupRows.length}</Badge>
              </div>
              <div className="border rounded divide-y">
                {groupRows.map((r) => (
                  <MappingRow key={r.wp_field_key} row={r} onChange={(patch) => update(r.wp_field_key, patch)} />
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function MappingRow({ row, onChange }: { row: Row; onChange: (p: Partial<Row>) => void }) {
  const artSource: ArtSource | null = row.art_source
    ? (ART_SOURCES.find((s) => s.key === row.art_source) ?? null)
    : null;
  return (
    <div className="grid grid-cols-12 gap-3 items-center p-3 text-sm">
      <div className="col-span-12 md:col-span-4 min-w-0">
        <div className="font-mono text-xs truncate">{row.wp_field_key}</div>
        {row.wp_label ? <div className="text-xs text-muted-foreground truncate">{row.wp_label}</div> : null}
        {row.sample ? (
          <div className="text-[11px] text-muted-foreground truncate mt-0.5">
            <span className="opacity-60">sample:</span> {row.sample || "—"}
          </div>
        ) : null}
        <div className="flex gap-1 mt-1">
          <Badge variant="outline" className="text-[10px]">{row.wp_kind}</Badge>
          {row.dirty ? <Badge className="text-[10px]">unsaved</Badge> : null}
        </div>
      </div>
      <div className="col-span-12 md:col-span-6">
        <Select
          value={row.art_source ?? UNMAPPED}
          onValueChange={(v) => onChange({ art_source: v === UNMAPPED ? null : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose ART field…">
              {artSource ? `${artSource.group} • ${artSource.label}` : "— Not mapped —"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-96">
            <SelectItem value={UNMAPPED}>— Not mapped —</SelectItem>
            {ART_SOURCE_GROUPS.map((g) => (
              <SelectGroup key={g}>
                <SelectLabel>{g}</SelectLabel>
                {ART_SOURCES.filter((s) => s.group === g).map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-12 md:col-span-2 flex items-center justify-end gap-2">
        <Label htmlFor={`en-${row.wp_field_key}`} className="text-xs text-muted-foreground">Enabled</Label>
        <Switch
          id={`en-${row.wp_field_key}`}
          checked={row.enabled}
          onCheckedChange={(v) => onChange({ enabled: v })}
        />
      </div>
    </div>
  );
}