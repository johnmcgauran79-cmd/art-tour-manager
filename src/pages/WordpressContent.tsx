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
    try {
      const res = await callProxy<Record<string, unknown>>({ op: "get_tour", tour_id: id });
      setSelectedTour(res);
    } catch (err) {
      toast.error((err as Error).message);
      setSelectedTour(null);
    } finally {
      setTourDetailLoading(false);
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
          Read-only view of tours and pages on australianracingtours.com.au. Phase 1 — no write actions.
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
                      {t.title ?? `(untitled) #${t.id}`}
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
            <pre className="text-xs whitespace-pre-wrap break-words bg-muted p-3 rounded">
              {JSON.stringify(selectedTour, null, 2)}
            </pre>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}