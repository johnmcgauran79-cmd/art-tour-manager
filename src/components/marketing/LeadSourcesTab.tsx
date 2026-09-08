import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  Link2,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useTags } from "@/hooks/useTags";
import { useTours } from "@/hooks/useTours";
import {
  PROVIDERS,
  useDeleteLeadIntegration,
  useDeleteTourMapping,
  useLeadIntegrationStats,
  useLeadIntegrations,
  useRotateIntegrationKey,
  useSaveLeadIntegration,
  useSaveTourMapping,
  useTourMappings,
  type LeadIntegration,
} from "@/hooks/useLeadIntegrations";

const ENDPOINT = "https://upqvgtuxfzsrwjahklij.supabase.co/functions/v1/lead-intake";
const NONE = "__none__";

const blank = (): Partial<LeadIntegration> => ({
  name: "",
  key: "",
  provider: "zapier",
  source_channel: "zapier",
  form_type: "interest",
  lead_source: "zapier",
  medium: "external",
  is_enabled: true,
  default_priority: "medium",
  followup_due_days: 1,
  ack_enabled: false,
  notify_teams: true,
  allow_consent: true,
  auto_tag_ids: [],
  task_assignee_ids: [],
  task_watcher_ids: [],
});

/**
 * Lead sources coming from outside the ART website (Facebook lead ads, Zapier,
 * partners, other systems). These only hold settings — every lead still goes
 * through the same intake as the website forms.
 */
export function LeadSourcesTab() {
  const { toast } = useToast();
  const { data: integrations = [], isLoading } = useLeadIntegrations();
  const { data: stats = {} } = useLeadIntegrationStats();
  const { data: staff = [] } = useAssignableUsers();
  const { data: templates = [] } = useEmailTemplates();
  const { data: tags = [] } = useTags();
  const { data: tours = [] } = useTours();

  const save = useSaveLeadIntegration();
  const remove = useDeleteLeadIntegration();
  const rotate = useRotateIntegrationKey();
  const saveMapping = useSaveTourMapping();
  const deleteMapping = useDeleteTourMapping();

  const [editing, setEditing] = useState<(Partial<LeadIntegration> & { id?: string }) | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [mapFor, setMapFor] = useState<LeadIntegration | null>(null);
  const [mapText, setMapText] = useState("");
  const [mapTour, setMapTour] = useState("");

  const upcoming = useMemo(
    () =>
      (tours as any[])
        .filter((t) => !["cancelled", "archived", "past"].includes(String(t.status || "")))
        .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date))),
    [tours]
  );

  const copy = (text: string, what: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${what} copied` });
  };

  const toggleId = (list: string[] | undefined, id: string) =>
    (list || []).includes(id) ? (list || []).filter((x) => x !== id) : [...(list || []), id];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Leads from Facebook, Zapier or a partner arrive here and are handled exactly like a website
          enquiry: the original is kept word-for-word, the contact is matched or created, an enquiry
          and follow-up task are raised, and the person is added to the timeline.
        </p>
        <Button onClick={() => setEditing(blank())} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add lead source
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading lead sources…</p>}

      <div className="grid gap-3 lg:grid-cols-2">
        {integrations.map((i) => {
          const s = stats[i.id];
          return (
            <Card key={i.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{i.name}</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {PROVIDERS.find((p) => p.value === i.provider)?.label || i.provider}
                      {i.partner_name ? ` · ${i.partner_name}` : ""}
                    </p>
                  </div>
                  <Badge variant={i.is_enabled ? "default" : "secondary"}>
                    {i.is_enabled ? "On" : "Off"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
                  <span>Leads received: {s?.total ?? 0}</span>
                  <span>Needing a look: {s?.review ?? 0}</span>
                  <span>
                    Last lead:{" "}
                    {s?.last ? format(new Date(s.last), "dd/MM/yyyy HH:mm") : "none yet"}
                  </span>
                </div>

                <div className="rounded-md border bg-muted/40 p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">Access key</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1"
                        disabled={rotate.isPending}
                        onClick={async () => {
                          const res = await rotate.mutateAsync({ integrationId: i.id });
                          if (res?.api_key) setNewKey(res.api_key);
                        }}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        {i.token_prefix ? "New key" : "Create key"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1"
                        onClick={() => copy(ENDPOINT, "Web address")}
                      >
                        <Copy className="h-3.5 w-3.5" /> Address
                      </Button>
                    </div>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {i.token_prefix
                      ? `${i.token_prefix}…  (last used ${
                          i.token_last_used_at
                            ? format(new Date(i.token_last_used_at), "dd/MM/yyyy HH:mm")
                            : "never"
                        })`
                      : "No key yet — create one to let this source send us leads."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(i)}>
                    Settings
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setMapFor(i);
                      setMapText("");
                      setMapTour("");
                    }}
                  >
                    <Link2 className="h-3.5 w-3.5" /> Tour wording
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-destructive"
                    onClick={() => {
                      if (confirm(`Remove ${i.name}? Leads already received are kept.`))
                        remove.mutate(i.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!isLoading && integrations.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No outside lead sources yet. Add one to start receiving leads from Facebook, Zapier or a
            partner.
          </CardContent>
        </Card>
      )}

      {/* Settings dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Lead source settings" : "Add a lead source"}</DialogTitle>
            <DialogDescription>
              Choose who owns these leads, how quickly they should be followed up and whether the
              person gets an acknowledgement.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={editing.name || ""}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="Facebook lead ads"
                  />
                </div>
                <div>
                  <Label>Short reference</Label>
                  <Input
                    value={editing.key || ""}
                    disabled={!!editing.id}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                      })
                    }
                    placeholder="meta_lead_ads"
                  />
                </div>
                <div>
                  <Label>Where the leads come from</Label>
                  <Select
                    value={editing.provider || "zapier"}
                    onValueChange={(provider) =>
                      setEditing({
                        ...editing,
                        provider,
                        source_channel:
                          PROVIDERS.find((p) => p.value === provider)?.channel || "api",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Treat as</Label>
                  <Select
                    value={editing.form_type || "interest"}
                    onValueChange={(form_type) => setEditing({ ...editing, form_type })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="interest">Register interest</SelectItem>
                      <SelectItem value="booking">Booking enquiry</SelectItem>
                      <SelectItem value="general">General enquiry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editing.provider === "partner" && (
                  <div className="sm:col-span-2">
                    <Label>Partner name</Label>
                    <Input
                      value={editing.partner_name || ""}
                      onChange={(e) => setEditing({ ...editing, partner_name: e.target.value })}
                    />
                  </div>
                )}
                <div className="sm:col-span-2">
                  <Label>Notes for staff</Label>
                  <Textarea
                    rows={2}
                    value={editing.description || ""}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Owner of these leads</Label>
                  <Select
                    value={editing.lead_owner_id || NONE}
                    onValueChange={(v) =>
                      setEditing({ ...editing, lead_owner_id: v === NONE ? null : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No one in particular</SelectItem>
                      {staff.map((u: any) => (
                        <SelectItem key={u.id} value={u.id}>
                          {`${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tour if the lead doesn't name one</Label>
                  <Select
                    value={editing.default_tour_id || NONE}
                    onValueChange={(v) =>
                      setEditing({ ...editing, default_tour_id: v === NONE ? null : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      {upcoming.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Follow up within (days)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editing.followup_due_days ?? 1}
                    onChange={(e) =>
                      setEditing({ ...editing, followup_due_days: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <Label>Task priority</Label>
                  <Select
                    value={editing.default_priority || "medium"}
                    onValueChange={(default_priority) =>
                      setEditing({ ...editing, default_priority })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label>Acknowledgement email</Label>
                  <Select
                    value={editing.ack_template_id || NONE}
                    onValueChange={(v) =>
                      setEditing({
                        ...editing,
                        ack_template_id: v === NONE ? null : v,
                        ack_enabled: v !== NONE,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Don't send one</SelectItem>
                      {templates.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 rounded-md border p-3">
                <Label className="text-xs uppercase text-muted-foreground">Tags to apply</Label>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t: any) => {
                    const on = (editing.auto_tag_ids || []).includes(t.id);
                    return (
                      <Button
                        key={t.id}
                        type="button"
                        variant={on ? "default" : "outline"}
                        size="sm"
                        className="h-7 gap-1"
                        onClick={() =>
                          setEditing({
                            ...editing,
                            auto_tag_ids: toggleId(editing.auto_tag_ids, t.id),
                          })
                        }
                      >
                        {on && <Check className="h-3 w-3" />} {t.name}
                      </Button>
                    );
                  })}
                  {tags.length === 0 && (
                    <span className="text-xs text-muted-foreground">No tags set up yet.</span>
                  )}
                </div>
              </div>

              <div className="space-y-2 rounded-md border p-3">
                <Label className="text-xs uppercase text-muted-foreground">
                  Who gets the follow-up task
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {staff.map((u: any) => {
                    const on = (editing.task_assignee_ids || []).includes(u.id);
                    return (
                      <Button
                        key={u.id}
                        type="button"
                        variant={on ? "default" : "outline"}
                        size="sm"
                        className="h-7 gap-1"
                        onClick={() =>
                          setEditing({
                            ...editing,
                            task_assignee_ids: toggleId(editing.task_assignee_ids, u.id),
                          })
                        }
                      >
                        {on && <Check className="h-3 w-3" />}
                        {`${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Switched on</Label>
                    <p className="text-xs text-muted-foreground">
                      When off, leads from this source are refused.
                    </p>
                  </div>
                  <Switch
                    checked={editing.is_enabled !== false}
                    onCheckedChange={(is_enabled) => setEditing({ ...editing, is_enabled })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Tell us on Teams if something fails</Label>
                  </div>
                  <Switch
                    checked={editing.notify_teams !== false}
                    onCheckedChange={(notify_teams) => setEditing({ ...editing, notify_teams })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Accept marketing consent from this source</Label>
                    <p className="text-xs text-muted-foreground">
                      Only ticks someone in for marketing when the source says they agreed.
                    </p>
                  </div>
                  <Switch
                    checked={editing.allow_consent !== false}
                    onCheckedChange={(allow_consent) => setEditing({ ...editing, allow_consent })}
                  />
                </div>
              </div>

              <div className="rounded-md border bg-muted/40 p-3 text-xs">
                <p className="font-medium">How the outside system sends us a lead</p>
                <p className="mt-1 text-muted-foreground">
                  Send the details to the web address below, with the access key in a header called{" "}
                  <code>x-api-key</code>. Fields understood: first_name, last_name, email, phone,
                  state, travellers, tour (name or reference), message, consent.
                </p>
                <code className="mt-2 block break-all rounded bg-background p-2">{ENDPOINT}</code>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={save.isPending || !editing?.name || !editing?.key}
              onClick={async () => {
                if (!editing) return;
                await save.mutateAsync(editing);
                setEditing(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Key shown once */}
      <Dialog open={!!newKey} onOpenChange={(v) => !v && setNewKey(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Your new access key</DialogTitle>
            <DialogDescription>
              Copy it now and paste it into the outside system — it is never shown again. Any older
              key has stopped working.
            </DialogDescription>
          </DialogHeader>
          <code className="block break-all rounded bg-muted p-3 text-sm">{newKey}</code>
          <DialogFooter>
            <Button
              className="gap-1.5"
              onClick={() => {
                copy(newKey || "", "Key");
                setNewKey(null);
              }}
            >
              <Copy className="h-4 w-4" /> Copy and close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tour wording mapping */}
      <TourMappingDialog
        integration={mapFor}
        onOpenChange={(v) => !v && setMapFor(null)}
        mapText={mapText}
        setMapText={setMapText}
        mapTour={mapTour}
        setMapTour={setMapTour}
        tours={upcoming}
        onSave={async () => {
          if (!mapFor || !mapText.trim() || !mapTour) return;
          await saveMapping.mutateAsync({
            integration_id: mapFor.id,
            external_key: mapText,
            tour_id: mapTour,
          });
          setMapText("");
          setMapTour("");
        }}
        onDelete={(id) => deleteMapping.mutate(id)}
      />
    </div>
  );
}

function TourMappingDialog({
  integration,
  onOpenChange,
  mapText,
  setMapText,
  mapTour,
  setMapTour,
  tours,
  onSave,
  onDelete,
}: {
  integration: LeadIntegration | null;
  onOpenChange: (v: boolean) => void;
  mapText: string;
  setMapText: (v: string) => void;
  mapTour: string;
  setMapTour: (v: string) => void;
  tours: any[];
  onSave: () => void;
  onDelete: (id: string) => void;
}) {
  const { data: mappings = [] } = useTourMappings(integration?.id);

  return (
    <Dialog open={!!integration} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Tour wording — {integration?.name}</DialogTitle>
          <DialogDescription>
            Outside systems often word a tour differently to us. Tell us which ART tour their wording
            means, and every future lead using that wording lands on the right tour.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Their wording</Label>
          <Input
            value={mapText}
            onChange={(e) => setMapText(e.target.value)}
            placeholder="Melbourne Cup 2026 Package"
          />
          <Label>Our tour</Label>
          <Select value={mapTour} onValueChange={setMapTour}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a tour" />
            </SelectTrigger>
            <SelectContent>
              {tours.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="mt-2" onClick={onSave} disabled={!mapText.trim() || !mapTour}>
            Add mapping
          </Button>
        </div>

        <div className="space-y-1">
          {mappings.length === 0 && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" /> No wording saved yet.
            </p>
          )}
          {mappings.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium">{m.external_label || m.external_key}</span>
                <span className="text-muted-foreground"> → {m.tour?.name || "—"}</span>
                {!m.integration_id && (
                  <Badge variant="secondary" className="ml-2">
                    All sources
                  </Badge>
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => onDelete(m.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
