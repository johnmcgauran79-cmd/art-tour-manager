import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  useAudiences,
  useDeleteAudience,
  useSaveAudience,
  type MarketingAudience,
} from "@/hooks/useMarketing";
import {
  AU_STATES,
  LEAD_STAGES,
  countAudience,
  describeFilters,
  type AudienceFilters,
} from "@/lib/edm/audience";

export function AudiencesTab() {
  const { toast } = useToast();
  const { data: audiences = [], isLoading } = useAudiences();
  const save = useSaveAudience();
  const del = useDeleteAudience();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<MarketingAudience> | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);

  const filters: AudienceFilters = editing?.filters || {};

  useEffect(() => {
    if (!open) return;
    setCounting(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      countAudience(filters)
        .then((n) => !cancelled && setCount(n))
        .catch(() => !cancelled && setCount(null))
        .finally(() => !cancelled && setCounting(false));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, JSON.stringify(filters)]);

  const setFilters = (patch: Partial<AudienceFilters>) =>
    setEditing({ ...editing, filters: { ...filters, ...patch } });

  const toggleIn = (key: "states" | "leadStages", value: string) => {
    const current = filters[key] || [];
    setFilters({
      [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    } as Partial<AudienceFilters>);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Saved segments built from live ART data. Only contacts with marketing consent are ever
          included.
        </p>
        <Button
          className="gap-1.5"
          onClick={() => {
            setEditing({ name: "", filters: {} });
            setCount(null);
            setOpen(true);
          }}
        >
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
            onClick={() => {
              setEditing(a);
              setOpen(true);
            }}
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
              <p className="text-xs text-muted-foreground">{describeFilters(a.filters)}</p>
              {a.last_count !== null && (
                <Badge variant="secondary">{a.last_count} contacts at last count</Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit audience" : "New audience"}</DialogTitle>
            <DialogDescription>
              Combine filters to target the right people. The count updates as you go.
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

              <div className="space-y-2">
                <Label>States</Label>
                <div className="flex flex-wrap gap-3">
                  {AU_STATES.map((s) => (
                    <label key={s} className="flex items-center gap-1.5 text-sm">
                      <Checkbox
                        checked={(filters.states || []).includes(s)}
                        onCheckedChange={() => toggleIn("states", s)}
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Lead stages</Label>
                <div className="flex flex-wrap gap-3">
                  {LEAD_STAGES.map((s) => (
                    <label key={s.value} className="flex items-center gap-1.5 text-sm">
                      <Checkbox
                        checked={(filters.leadStages || []).includes(s.value)}
                        onCheckedChange={() => toggleIn("leadStages", s.value)}
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={!!filters.pastTravellersOnly}
                    onCheckedChange={(v) =>
                      setFilters({ pastTravellersOnly: !!v, neverTravelledOnly: false })
                    }
                  />
                  Past travellers only
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={!!filters.neverTravelledOnly}
                    onCheckedChange={(v) =>
                      setFilters({ neverTravelledOnly: !!v, pastTravellersOnly: false })
                    }
                  />
                  Never travelled only
                </label>
                <div className="space-y-1.5">
                  <Label>Last travelled before</Label>
                  <Input
                    type="date"
                    value={filters.latestTourBefore || ""}
                    onChange={(e) => setFilters({ latestTourBefore: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Name or email contains</Label>
                  <Input
                    value={filters.search || ""}
                    onChange={(e) => setFilters({ search: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
                {counting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Users className="h-4 w-4" />
                )}
                <span className="text-sm">
                  {count === null ? "Counting…" : `${count} consented contacts match`}
                </span>
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
