import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdminOrManager } from "@/hooks/useUserRoles";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, RefreshCcw, ExternalLink, Loader2, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { WordpressFieldMappingSection } from "@/components/wordpress/WordpressFieldMappingSection";
import { WordpressBulkMatchSection } from "@/components/wordpress/WordpressBulkMatchSection";
import { WordpressBulkDiffSection } from "@/components/wordpress/WordpressBulkDiffSection";

// ---------------------------------------------------------------------------
// ACF field summary helpers
// ---------------------------------------------------------------------------
// Flat "headline" ACF fields we want to surface prominently for review /
// future editing. Keys match the ACF field "Name" column in the field group
// (Australian_Racing_Tours_-_ACF_Fields_Names_and_Keys.pdf).
const HEADLINE_ACF_FIELDS: Array<{ key: string; label: string; kind: "text" | "html" | "file" }> = [
  { key: "price", label: "Price (display)", kind: "text" },
  { key: "status", label: "Status", kind: "text" },
  { key: "radio_book_now", label: "Display Book Now button?", kind: "text" },
  { key: "start_date", label: "Start date", kind: "text" },
  { key: "end_date", label: "End date", kind: "text" },
  { key: "time_frame", label: "Time frame", kind: "text" },
  { key: "location", label: "Location", kind: "text" },
  { key: "capacity", label: "Capacity", kind: "text" },
  { key: "single_room_price", label: "Single room price", kind: "text" },
  { key: "twin_room_per_person_price", label: "Twin room (per person)", kind: "text" },
  { key: "double_room_per_person_price", label: "Double room (per person)", kind: "text" },
  { key: "payment_details", label: "Payment details", kind: "html" },
  { key: "add_download_brochure", label: "Show 'Download brochure'?", kind: "text" },
  { key: "attach_brochure_here", label: "Brochure file", kind: "file" },
];

// Repeaters we surface item counts for and pass through unchanged on save.
const REPEATER_ACF_FIELDS = [
  { key: "inclusions", label: "Inclusions" },
  { key: "exclusions_details", label: "Exclusions" },
  { key: "faqs_list", label: "FAQs" },
  { key: "add_review", label: "Reviews" },
] as const;

type AcfSummary = { key: string; type: string; detail: string };

function summariseAcf(acf: unknown): AcfSummary[] {
  if (!acf || typeof acf !== "object" || Array.isArray(acf)) return [];
  const rows: AcfSummary[] = [];
  for (const [key, value] of Object.entries(acf as Record<string, unknown>)) {
    if (value === null || value === undefined || value === "") {
      rows.push({ key, type: "empty", detail: "—" });
      continue;
    }
    if (Array.isArray(value)) {
      rows.push({ key, type: "array", detail: `${value.length} item${value.length === 1 ? "" : "s"}` });
      continue;
    }
    if (typeof value === "object") {
      const keys = Object.keys(value as Record<string, unknown>);
      rows.push({ key, type: "group", detail: `${keys.length} sub-field${keys.length === 1 ? "" : "s"}` });
      continue;
    }
    if (typeof value === "boolean") {
      rows.push({ key, type: "boolean", detail: value ? "true" : "false" });
      continue;
    }
    const str = String(value);
    rows.push({
      key,
      type: typeof value,
      detail: str.length > 80 ? `${str.slice(0, 80)}…` : str,
    });
  }
  return rows.sort((a, b) => a.key.localeCompare(b.key));
}

function stripHtml(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// ACF File field can arrive as an ID (number/string) or as an object with
// { id, url, filename, ... }. Normalise both shapes to the numeric attachment
// ID as a string, which is what we store in formValues and post back.
function fileFieldId(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return /^\d+$/.test(v) ? v : "";
  if (typeof v === "object" && v && "id" in (v as Record<string, unknown>)) {
    const id = (v as Record<string, unknown>).id;
    if (typeof id === "number") return String(id);
    if (typeof id === "string" && /^\d+$/.test(id)) return id;
  }
  return "";
}
function fileFieldMeta(v: unknown): { id: string; url: string | null; filename: string | null } {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    return {
      id: fileFieldId(o),
      url: (typeof o.url === "string" ? o.url : null) ?? (typeof o.source_url === "string" ? o.source_url : null),
      filename: (typeof o.filename === "string" ? o.filename : null) ?? (typeof o.title === "string" ? o.title : null),
    };
  }
  return { id: fileFieldId(v), url: null, filename: null };
}

function extractYear(...vals: Array<string | null | undefined>): string | null {
  for (const v of vals) {
    if (!v) continue;
    const m = String(v).match(/(20\d{2}|19\d{2})/);
    if (m) return m[1];
  }
  return null;
}

function displayTourTitle(t: { title: string | null; id: number; start_date?: string | null; end_date?: string | null; modified?: string }): string {
  const raw = t.title ?? `(untitled) #${t.id}`;
  if (/(19|20)\d{2}/.test(raw)) return raw;
  const year = extractYear(t.start_date, t.end_date);
  return year ? `${year} ${raw}` : raw;
}

interface HealthResult {
  reachable: boolean;
  authenticated: boolean;
  tour_endpoint: boolean;
  pages_endpoint: boolean;
  media_endpoint: boolean;
  username: string | null;
  errors: Array<{ where: string; message: string; category: string; status: number }>;
  recommendations: string[];
}

interface TourRow {
  id: number;
  title: string | null;
  slug: string;
  status: string;
  link: string;
  modified: string;
  excerpt: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

interface AuditRow {
  id: string;
  created_at: string;
  action: string;
  wordpress_object_type: string | null;
  wordpress_object_id: number | null;
  result_status: string;
  response_code: number | null;
  error_message: string | null;
  source: string;
}

async function callProxy<T>(op: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("wp-content-proxy", { body: op });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

export default function WordpressContent() {
  const { user, loading } = useAuth();
  const { isAdminOrManager, isLoading: rolesLoading } = useIsAdminOrManager();

  const [health, setHealth] = useState<HealthResult | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [lastTested, setLastTested] = useState<Date | null>(null);

  const [search, setSearch] = useState("");
  const [tours, setTours] = useState<TourRow[]>([]);
  const [toursLoading, setToursLoading] = useState(false);

  const [selectedTour, setSelectedTour] = useState<Record<string, unknown> | null>(null);
  const [tourDetailLoading, setTourDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingBrochure, setUploadingBrochure] = useState(false);

  const acfRaw = selectedTour && typeof (selectedTour as { acf?: unknown }).acf === "object"
    ? ((selectedTour as { acf?: Record<string, unknown> }).acf ?? null)
    : null;
  const acfSummary = summariseAcf(acfRaw);
  const acfExposed = acfSummary.length > 0;
  const selectedTourId = typeof (selectedTour as { id?: unknown })?.id === "number"
    ? ((selectedTour as { id: number }).id)
    : null;
  const changedFields = HEADLINE_ACF_FIELDS.filter((f) => {
    const original = (acfRaw as Record<string, unknown>)?.[f.key];
    const originalStr = f.kind === "file"
      ? fileFieldId(original)
      : original === null || original === undefined ? "" : String(original);
    return (formValues[f.key] ?? "") !== originalStr;
  });

  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    if (isAdminOrManager) {
      void runHealthCheck();
      void loadTours("");
      void loadAudit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminOrManager]);

  if (loading || rolesLoading) return <div className="p-6">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdminOrManager) return <Navigate to="/" replace />;

  async function runHealthCheck() {
    setHealthLoading(true);
    try {
      const res = await callProxy<HealthResult>({ op: "health" });
      setHealth(res);
      setLastTested(new Date());
      if (!res.authenticated) toast.error("WordPress authentication failed");
      else toast.success("WordPress is reachable and authenticated");
      void loadAudit();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setHealthLoading(false);
    }
  }

  async function loadTours(q: string) {
    setToursLoading(true);
    try {
      const res = await callProxy<{ tours: TourRow[] }>({ op: "list_tours", search: q || undefined, per_page: 20 });
      setTours(res.tours ?? []);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setToursLoading(false);
    }
  }

  async function openTour(id: number) {
    setTourDetailLoading(true);
    setSelectedTour({ id });
    setEditing(false);
    setFormValues({});
    try {
      const res = await callProxy<Record<string, unknown>>({ op: "get_tour", tour_id: id });
      setSelectedTour(res);
      const acf = (res as { acf?: Record<string, unknown> }).acf ?? {};
      const initial: Record<string, string> = {};
      for (const f of HEADLINE_ACF_FIELDS) {
        const v = acf?.[f.key];
        initial[f.key] = v === null || v === undefined ? "" : String(v);
      }
      setFormValues(initial);
    } catch (err) {
      toast.error((err as Error).message);
      setSelectedTour(null);
    } finally {
      setTourDetailLoading(false);
    }
  }

  async function saveChanges() {
    if (!selectedTourId || changedFields.length === 0) return;
    setSaving(true);
    try {
      const acfPayload: Record<string, unknown> = {};
      for (const f of changedFields) acfPayload[f.key] = formValues[f.key];
      const res = await callProxy<{ ok: boolean; changed_fields: string[]; acf: Record<string, unknown> }>({
        op: "update_tour",
        tour_id: selectedTourId,
        acf: acfPayload,
      });
      toast.success(`Updated ${res.changed_fields.length} field${res.changed_fields.length === 1 ? "" : "s"} on WordPress`);
      // Refresh the detail view with the WP-returned acf
      setSelectedTour((prev) => (prev ? { ...prev, acf: res.acf } : prev));
      const refreshed: Record<string, string> = {};
      for (const f of HEADLINE_ACF_FIELDS) {
        const v = res.acf?.[f.key];
        refreshed[f.key] = v === null || v === undefined ? "" : String(v);
      }
      setFormValues(refreshed);
      setConfirmOpen(false);
      setEditing(false);
      void loadAudit();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function loadAudit() {
    const { data } = await supabase
      .from("wordpress_integration_audit_logs")
      .select("id, created_at, action, wordpress_object_type, wordpress_object_id, result_status, response_code, error_message, source")
      .order("created_at", { ascending: false })
      .limit(30);
    setAuditRows((data ?? []) as AuditRow[]);
  }

  const statusIcon = (ok: boolean) =>
    ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">WordPress Content Integration</h1>
        <p className="text-sm text-muted-foreground">
          Browse tours and pages on australianracingtours.com.au. Headline ACF fields on tours are editable with confirmation and audit logging.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Connection status</CardTitle>
          <Button size="sm" variant="outline" onClick={runHealthCheck} disabled={healthLoading}>
            {healthLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
            Test Connection
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {health ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-2">{statusIcon(health.reachable)} Reachable</div>
                <div className="flex items-center gap-2">{statusIcon(health.authenticated)} Authenticated</div>
                <div className="flex items-center gap-2">{statusIcon(health.tour_endpoint)} /tour endpoint</div>
                <div className="flex items-center gap-2">{statusIcon(health.pages_endpoint)} /pages endpoint</div>
                <div className="flex items-center gap-2">{statusIcon(health.media_endpoint)} /media endpoint</div>
                <div className="flex items-center gap-2">
                  WP user: <Badge variant="secondary">{health.username ?? "—"}</Badge>
                </div>
              </div>
              {lastTested && (
                <p className="text-xs text-muted-foreground">Last tested {format(lastTested, "dd/MM/yyyy HH:mm:ss")}</p>
              )}
              {health.recommendations.length > 0 && (
                <div className="text-sm bg-yellow-50 border border-yellow-200 rounded p-3">
                  <div className="font-medium mb-1">Recommendations</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {health.recommendations.map((r, i) => (<li key={i}>{r}</li>))}
                  </ul>
                </div>
              )}
              {health.errors.length > 0 && (
                <div className="text-sm bg-red-50 border border-red-200 rounded p-3">
                  <div className="font-medium mb-1">Errors</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {health.errors.map((e, i) => (<li key={i}><code>{e.where}</code> — {e.message} ({e.status})</li>))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Not yet tested.</p>
          )}
        </CardContent>
      </Card>

      <WordpressFieldMappingSection />

      <WordpressBulkMatchSection />

      <WordpressBulkDiffSection />

      <Card>
        <CardHeader>
          <CardTitle>Tours</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex gap-2 mb-4"
            onSubmit={(e) => { e.preventDefault(); void loadTours(search); }}
          >
            <Input placeholder="Search WordPress tours…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button type="submit" disabled={toursLoading}>
              <Search className="h-4 w-4 mr-2" /> Search
            </Button>
          </form>
          {toursLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : tours.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tours found.</p>
          ) : (
            <div className="border rounded divide-y">
              {tours.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                  <div className="min-w-0">
                    <button className="text-left font-medium hover:underline truncate block" onClick={() => openTour(t.id)}>
                      {displayTourTitle(t)}
                    </button>
                    <div className="text-xs text-muted-foreground">
                      <Badge variant="outline" className="mr-2">{t.status}</Badge>
                      Modified {format(new Date(t.modified), "dd/MM/yyyy HH:mm")}
                    </div>
                  </div>
                  <a href={t.link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Integration audit log</CardTitle></CardHeader>
        <CardContent>
          {auditRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit entries yet.</p>
          ) : (
            <div className="text-xs border rounded divide-y max-h-96 overflow-y-auto">
              {auditRows.map((r) => (
                <div key={r.id} className="grid grid-cols-6 gap-2 p-2 items-center">
                  <div className="col-span-2">{format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss")}</div>
                  <div><Badge variant="outline">{r.source}</Badge></div>
                  <div className="font-mono">{r.action}</div>
                  <div>{r.wordpress_object_type ?? "—"}{r.wordpress_object_id ? ` #${r.wordpress_object_id}` : ""}</div>
                  <div>
                    <Badge variant={r.result_status === "success" ? "secondary" : "destructive"}>
                      {r.result_status}{r.response_code ? ` ${r.response_code}` : ""}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedTour} onOpenChange={(o) => { if (!o) setSelectedTour(null); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>WordPress tour detail</DialogTitle>
          </DialogHeader>
          {tourDetailLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : selectedTour ? (
            <div className="space-y-4">
              <div className="rounded border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-sm">ACF custom fields</div>
                  {acfExposed ? (
                    <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-600" /> Exposed via REST</Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Not exposed</Badge>
                  )}
                </div>
                {!acfExposed ? (
                  <p className="text-xs text-muted-foreground">
                    No <code>acf</code> object was returned for this tour. Confirm the "Tour" ACF field group has "Show in REST API" enabled and that the individual fields also have <code>show_in_rest</code> set.
                  </p>
                ) : (
                  <>
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-muted-foreground">Headline fields (editable)</div>
                        {!editing ? (
                          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
                        ) : (
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => {
                              // reset from acfRaw
                              const initial: Record<string, string> = {};
                              for (const f of HEADLINE_ACF_FIELDS) {
                                const v = (acfRaw as Record<string, unknown>)?.[f.key];
                                initial[f.key] = v === null || v === undefined ? "" : String(v);
                              }
                              setFormValues(initial);
                              setEditing(false);
                            }}>Cancel</Button>
                            <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={changedFields.length === 0}>
                              Save {changedFields.length > 0 ? `(${changedFields.length})` : ""}
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        {HEADLINE_ACF_FIELDS.map((f) => {
                          const currentValue = formValues[f.key] ?? "";
                          const original = (acfRaw as Record<string, unknown>)?.[f.key];
                          const originalStr = original === null || original === undefined ? "" : String(original);
                          const dirty = editing && currentValue !== originalStr;
                          return (
                            <div key={f.key} className={`space-y-1 border-b pb-2 ${dirty ? "bg-amber-50/60 -mx-1 px-1 rounded" : ""}`}>
                              <Label className="text-[11px] text-muted-foreground flex justify-between">
                                <span>{f.label}</span>
                                <code className="opacity-60">{f.key}</code>
                              </Label>
                              {editing ? (
                                f.kind === "html" ? (
                                  <Textarea
                                    className="text-xs min-h-[80px]"
                                    value={currentValue}
                                    onChange={(e) => setFormValues((v) => ({ ...v, [f.key]: e.target.value }))}
                                  />
                                ) : (
                                  <Input
                                    className="h-7 text-xs"
                                    value={currentValue}
                                    onChange={(e) => setFormValues((v) => ({ ...v, [f.key]: e.target.value }))}
                                  />
                                )
                              ) : (
                                <div className="text-xs">
                                  {originalStr === ""
                                    ? <span className="text-muted-foreground">—</span>
                                    : f.kind === "html"
                                      ? <span className="text-muted-foreground">{stripHtml(originalStr).slice(0, 140)}{stripHtml(originalStr).length > 140 ? "…" : ""}</span>
                                      : <span className="font-medium">{originalStr}</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mb-3">
                      <div className="text-xs font-medium text-muted-foreground mb-1">Repeaters (read-only preview)</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        {REPEATER_ACF_FIELDS.map((r) => {
                          const v = (acfRaw as Record<string, unknown>)?.[r.key];
                          const count = Array.isArray(v) ? v.length : 0;
                          return (
                            <div key={r.key} className="rounded border p-2">
                              <div className="font-medium">{r.label}</div>
                              <div className="text-muted-foreground">{count} item{count === 1 ? "" : "s"}</div>
                              <code className="opacity-60">{r.key}</code>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Row-level editing for these repeaters, plus Hotels 1–5 and the Itinerary, is queued for the next phase — the MCP <code>wordpress_get_tour</code> already returns their full sub-field data for Codex/Claude Code to read.
                      </p>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">
                        All ACF keys ({acfSummary.length})
                      </div>
                      <div className="text-xs border rounded divide-y max-h-64 overflow-y-auto">
                        {acfSummary.map((r) => (
                          <div key={r.key} className="grid grid-cols-6 gap-2 p-1.5">
                            <code className="col-span-2 truncate">{r.key}</code>
                            <div className="col-span-1"><Badge variant="outline">{r.type}</Badge></div>
                            <div className="col-span-3 text-muted-foreground truncate">{r.detail}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">Raw JSON response</summary>
                <pre className="text-xs whitespace-pre-wrap break-words bg-muted p-3 rounded mt-2">
                  {JSON.stringify(selectedTour, null, 2)}
                </pre>
              </details>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={(o) => { if (!o && !saving) setConfirmOpen(false); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirm changes to WordPress</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            These changes will be written to the live WordPress tour immediately. Every save is recorded in the integration audit log.
          </p>
          <div className="border rounded divide-y text-xs mt-2 max-h-[50vh] overflow-y-auto">
            {changedFields.length === 0 ? (
              <div className="p-3 text-muted-foreground">No changes.</div>
            ) : changedFields.map((f) => {
              const original = (acfRaw as Record<string, unknown>)?.[f.key];
              const originalStr = original === null || original === undefined ? "" : String(original);
              const newStr = formValues[f.key] ?? "";
              return (
                <div key={f.key} className="p-2 grid grid-cols-1 md:grid-cols-[160px,1fr,1fr] gap-2">
                  <div className="font-medium">{f.label}<div className="text-[10px] text-muted-foreground"><code>{f.key}</code></div></div>
                  <div className="bg-red-50 border border-red-100 rounded p-2 line-through opacity-80 break-words">
                    {originalStr === "" ? <span className="opacity-50">(empty)</span> : originalStr}
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded p-2 break-words">
                    {newStr === "" ? <span className="opacity-50">(empty)</span> : newStr}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={saveChanges} disabled={saving || changedFields.length === 0}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving…</> : `Save ${changedFields.length} field${changedFields.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}