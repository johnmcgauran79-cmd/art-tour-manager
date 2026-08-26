import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  useAudiences,
  useDeleteAudience,
  useSaveAudience,
  type MarketingAudience,
} from "@/hooks/useMarketing";
import {
  countAudience,
  describeFilters,
  hasRules,
  type AudienceFilters,
} from "@/lib/edm/audience";
import {
  defaultRule,
  emptyGroup,
  newId,
  type AudienceGroup,
  type AudienceNode,
} from "@/lib/edm/audienceRules";
import { AudienceRuleBuilder } from "./AudienceRuleBuilder";
import { useContactStateCounts } from "@/hooks/useBrevoAudienceSync";

import { useTags } from "@/hooks/useTags";
import { useTours } from "@/hooks/useTours";

/** Turn a legacy (flat) filter set into an equivalent rule tree so old
 *  audiences can be edited in the new builder without losing their meaning. */
const legacyToRules = (f: AudienceFilters): AudienceGroup => {
  const children: AudienceNode[] = [];
  const push = (node: Partial<AudienceNode> & { field: any; operator: any; value?: any }) =>
    children.push({ id: newId(), kind: "rule", ...node } as AudienceNode);

  if (f.states?.length) push({ field: "state", operator: "in", value: f.states });
  if (f.leadStages?.length) push({ field: "lead_stage", operator: "in", value: f.leadStages });
  if (f.leadSources?.length) push({ field: "lead_source", operator: "in", value: f.leadSources });
  if (f.tagIds?.length) push({ field: "tag", operator: "in", value: f.tagIds });
  if (f.pastTravellersOnly) push({ field: "has_travelled", operator: "is_true" });
  if (f.neverTravelledOnly) push({ field: "has_travelled", operator: "is_false" });
  if (f.interestedTourId)
    push({ field: "interested_tour", operator: "eq", value: f.interestedTourId });
  if (f.latestTourBefore)
    push({ field: "latest_tour_end_date", operator: "before", value: f.latestTourBefore });
  if (f.search) push({ field: "name_email", operator: "contains", value: f.search });

  return { ...emptyGroup("and"), children };
};

export function AudiencesTab() {
  const { toast } = useToast();
  const { data: audiences = [], isLoading } = useAudiences();
  const { data: allTags = [] } = useTags();
  const { data: tours = [] } = useTours();
  const { data: stateCounts } = useContactStateCounts();

  const save = useSaveAudience();
  const del = useDeleteAudience();

  const { data: leadSources = [] } = useQuery({
    queryKey: ["marketing-lead-sources"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("customers")
        .select("lead_source")
        .not("lead_source", "is", null)
        .limit(1000);
      if (error) throw error;
      return [...new Set((data || []).map((r: any) => r.lead_source).filter(Boolean))].sort();
    },
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<MarketingAudience> | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);

  const filters: AudienceFilters = editing?.filters || {};
  const rules: AudienceGroup = (filters.rules as AudienceGroup) || emptyGroup("and");

  const lookup = useMemo(
    () => ({
      tags: Object.fromEntries(allTags.map((t) => [t.id, t.name])),
      tours: Object.fromEntries((tours as any[]).map((t) => [t.id, t.name])),
    }),
    [allTags, tours]
  );

  const builderOptions = useMemo(
    () => ({
      tags: allTags.map((t) => ({ id: t.id, name: t.name })),
      tours: (tours as any[]).map((t) => ({ id: t.id, name: t.name })),
      leadSources,
      stateCounts,
    }),
    [allTags, tours, leadSources, stateCounts]
  );


  useEffect(() => {
    if (!open) return;
    setCounting(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      countAudience(filters)
        .then((n) => !cancelled && setCount(n))
        .catch(() => !cancelled && setCount(null))
        .finally(() => !cancelled && setCounting(false));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, JSON.stringify(filters)]);

  const openAudience = (a?: MarketingAudience) => {
    if (!a) {
      setEditing({
        name: "",
        filters: { rules: { ...emptyGroup("and"), children: [defaultRule()] } },
      });
    } else {
      const f: AudienceFilters = a.filters || {};
      setEditing({ ...a, filters: hasRules(f) ? f : { rules: legacyToRules(f) } });
    }
    setCount(null);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Saved segments built from live ART data with nested AND / OR / NOT rules. Only contacts
          with marketing consent are ever included.
        </p>
        <Button className="gap-1.5" onClick={() => openAudience()}>
          <Plus className="h-4 w-4" /> New audience
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading audiences…</p>}
        {!isLoading && audiences.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No audiences yet — create one to start segmenting.
          </p>
        )}
        {audiences.map((a) => (
          <Card
            key={a.id}
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => openAudience(a)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" /> {a.name}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  aria-label="Delete audience"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete audience "${a.name}"?`)) del.mutate(a.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardTitle>
              {a.description && <CardDescription>{a.description}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">{describeFilters(a.filters, lookup)}</p>
              {a.last_count !== null && (
                <Badge variant="secondary">{a.last_count} contacts at last count</Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit audience" : "New audience"}</DialogTitle>
            <DialogDescription>
              Combine rules and nested groups — e.g. (NSW or VIC) and tagged “Ladies client” but not
              travelled in the last 365 days. The count updates as you go.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Audience name</Label>
                  <Input
                    value={editing.name || ""}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="NSW past travellers"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input
                    value={editing.description || ""}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  />
                </div>
              </div>

              <AudienceRuleBuilder
                value={rules}
                options={builderOptions}
                onChange={(next) => setEditing({ ...editing, filters: { rules: next } })}
              />

              <div className="space-y-1.5 rounded-md border bg-muted/40 p-3">
                <div className="flex items-center gap-2">
                  {counting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                  <span className="text-sm">
                    {count === null ? "Counting…" : `${count} consented contacts match`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {describeFilters(editing.filters || {}, lookup)}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!editing?.name) {
                  toast({ title: "Give the audience a name", variant: "destructive" });
                  return;
                }
                await save.mutateAsync({
                  ...editing,
                  last_count: count ?? null,
                  last_counted_at: count === null ? null : new Date().toISOString(),
                });
                setOpen(false);
              }}
              disabled={save.isPending}
            >
              Save audience
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
