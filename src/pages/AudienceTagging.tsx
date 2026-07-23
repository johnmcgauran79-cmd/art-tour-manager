import { useEffect, useMemo, useState } from "react";
import { getGender } from "gender-detection-from-name";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Sparkles, Users } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Customer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  keap_contact_id: string | null;
};

type Classification = "female" | "male" | "unknown";

type Row = Customer & { classification: Classification; alreadyTagged: boolean; inKeap: boolean };

const BATCH = 25;

// Names the classifier sometimes mis-labels as female — force to male.
const MALE_OVERRIDES = new Set(
  ["adam", "nathan", "neil", "keith", "chris", "damien", "damian", "aaron"]
);

export default function AudienceTagging() {
  const { data: roles = [], isLoading: roleLoading } = useUserRoles();
  const isAdmin = roles.includes("admin");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [tagId, setTagId] = useState<string>("397");
  const [tagLabel, setTagLabel] = useState<string>("Females (Ladies Tour)");
  const [manualSelected, setManualSelected] = useState<Set<string>>(new Set());
  const [femaleExcluded, setFemaleExcluded] = useState<Set<string>>(new Set());
  const [femaleSearch, setFemaleSearch] = useState("");
  const [pushing, setPushing] = useState(false);
  const [matching, setMatching] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      try {
        // Load ALL customers with a first name (Keap presence is a separate flag)
        const all: Customer[] = [];
        const pageSize = 1000;
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from("customers")
            .select("id, first_name, last_name, email, keap_contact_id")
            .not("first_name", "is", null)
            .order("last_name", { ascending: true })
            .range(from, from + pageSize - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all.push(...(data as Customer[]));
          if (data.length < pageSize) break;
          from += pageSize;
        }

        // Load previously-applied audience tags to hide already-tagged customers
        const { data: previouslyTagged } = await supabase
          .from("audit_log")
          .select("record_id, details")
          .eq("operation_type", "KEAP_APPLY_AUDIENCE_TAG");
        const taggedSet = new Set<string>();
        for (const r of previouslyTagged || []) {
          const detailTag = (r as any)?.details?.keap_tag_id;
          if (String(detailTag) === String(tagId)) taggedSet.add((r as any).record_id);
        }

        const classified: Row[] = all.map((c) => {
          const raw = (c.first_name || "").trim().split(/[\s-]+/)[0]; // first token only
          const lower = raw.toLowerCase();
          const g = MALE_OVERRIDES.has(lower) ? "male" : (raw ? getGender(raw) : "unknown");
          return {
            ...c,
            classification: (g === "male" || g === "female") ? g : "unknown",
            alreadyTagged: taggedSet.has(c.id),
            inKeap: !!c.keap_contact_id,
          };
        });
        setRows(classified);
      } catch (e: any) {
        toast.error("Failed to load contacts", { description: e?.message });
      } finally {
        setLoading(false);
      }
    })();
     
  }, [isAdmin, tagId]);

  const females = useMemo(
    () => rows.filter((r) => r.classification === "female" && !r.alreadyTagged && !femaleExcluded.has(r.id)),
    [rows, femaleExcluded]
  );
  const femalesInKeap = useMemo(() => females.filter((r) => r.inKeap), [females]);
  const femalesNotInKeap = useMemo(() => females.filter((r) => !r.inKeap && !!r.email), [females]);
  const males = useMemo(() => rows.filter((r) => r.classification === "male"), [rows]);
  const unknowns = useMemo(() => rows.filter((r) => r.classification === "unknown" && !r.alreadyTagged && r.inKeap), [rows]);
  const alreadyTagged = useMemo(() => rows.filter((r) => r.alreadyTagged), [rows]);

  const filteredFemales = useMemo(() => {
    const q = femaleSearch.trim().toLowerCase();
    if (!q) return females;
    return females.filter((r) =>
      [r.first_name, r.last_name, r.email].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [females, femaleSearch]);

  const filteredUnknowns = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return unknowns;
    return unknowns.filter((r) =>
      [r.first_name, r.last_name, r.email].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [unknowns, search]);

  const toggleUnknown = (id: string) => {
    setManualSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAllUnknowns = () => {
    if (manualSelected.size === filteredUnknowns.length) setManualSelected(new Set());
    else setManualSelected(new Set(filteredUnknowns.map((r) => r.id)));
  };

  const pushTag = async (customerIds: string[], label: string) => {
    if (customerIds.length === 0) {
      toast.info("Nothing to tag");
      return;
    }
    const numericTag = Number(tagId);
    if (!numericTag) {
      toast.error("Enter a valid numeric Keap tag ID");
      return;
    }
    setPushing(true);
    try {
      let applied = 0, skipped = 0, failed = 0;
      // Chunk client-side to keep individual invocations short.
      for (let i = 0; i < customerIds.length; i += BATCH) {
        const chunk = customerIds.slice(i, i + BATCH);
        const { data, error } = await supabase.functions.invoke("keap-apply-tag-bulk", {
          body: { tagId: numericTag, customerIds: chunk, reason: `audience:${tagLabel}` },
        });
        if (error) throw error;
        applied += data?.applied || 0;
        skipped += data?.skipped || 0;
        failed += data?.failed || 0;
        toast.message(`${label}: batch ${Math.floor(i / BATCH) + 1}`, {
          description: `Applied ${applied} · Skipped ${skipped} · Failed ${failed}`,
        });
      }
      toast.success(`${label} complete`, {
        description: `Applied ${applied} · Skipped ${skipped} · Failed ${failed}`,
      });
      // Mark them as already tagged in-memory
      setRows((prev) => prev.map((r) => customerIds.includes(r.id) ? { ...r, alreadyTagged: true } : r));
      setManualSelected(new Set());
    } catch (e: any) {
      toast.error("Tag push failed", { description: e?.message });
    } finally {
      setPushing(false);
    }
  };

  if (roleLoading) return null;
  if (!isAdmin) {
    return <div className="p-6 text-sm text-muted-foreground">Admin access only.</div>;
  }

  const runMatchByEmail = async (ids?: string[]) => {
    setMatching(true);
    try {
      let totalMatched = 0, totalNotFound = 0, totalFailed = 0, totalProcessed = 0;
      // Chunk to keep each invocation snappy.
      const CHUNK = 200;
      const list = ids && ids.length > 0 ? ids : undefined;
      const chunks: (string[] | undefined)[] = list
        ? Array.from({ length: Math.ceil(list.length / CHUNK) }, (_, i) => list.slice(i * CHUNK, (i + 1) * CHUNK))
        : [undefined];
      for (const chunk of chunks) {
        const { data, error } = await supabase.functions.invoke("keap-match-contacts-by-email", {
          body: chunk ? { customerIds: chunk } : { limit: 500 },
        });
        if (error) throw error;
        totalMatched += data?.matched || 0;
        totalNotFound += data?.notFound || 0;
        totalFailed += data?.failed || 0;
        totalProcessed += data?.processed || 0;
      }
      toast.success("Keap email match complete", {
        description: `Processed ${totalProcessed} · Matched ${totalMatched} · Not in Keap ${totalNotFound} · Failed ${totalFailed}`,
      });
      // Refresh page data by bumping tagId dependency isn't ideal; do a light reload of rows
      const { data: refreshed } = await supabase
        .from("customers")
        .select("id, keap_contact_id")
        .in("id", (ids && ids.length > 0) ? ids : rows.map((r) => r.id));
      if (refreshed) {
        const map = new Map(refreshed.map((r: any) => [r.id, r.keap_contact_id]));
        setRows((prev) => prev.map((r) => map.has(r.id) ? { ...r, inKeap: !!map.get(r.id), keap_contact_id: map.get(r.id) as any } : r));
      }
    } catch (e: any) {
      toast.error("Match failed", { description: e?.message });
    } finally {
      setMatching(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Audience Tagging
          </h1>
          <p className="text-sm text-muted-foreground">
            Classify ART Admin contacts (already synced to Keap) by likely gender via first name, then push a Keap tag for targeted campaigns like the Ladies Tour.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tag configuration</CardTitle>
          <CardDescription>The Keap tag applied to selected contacts.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="tag-id">Keap tag ID</Label>
            <Input id="tag-id" value={tagId} onChange={(e) => setTagId(e.target.value)} placeholder="397" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="tag-label">Label (audit only)</Label>
            <Input id="tag-label" value={tagLabel} onChange={(e) => setTagLabel(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Match contacts to Keap by email</CardTitle>
            <CardDescription>
              Many ART contacts aren't linked to Keap yet. This looks up unlinked emails in Keap and, when a match exists, stores the Keap contact ID (no new Keap contacts created). Run this before pushing tags to widen the pushable pool.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <Button variant="outline" disabled={matching} onClick={() => runMatchByEmail()}>
              {matching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Match next 500 unlinked
            </Button>
            <Button
              disabled={matching || femalesNotInKeap.length === 0}
              onClick={() => runMatchByEmail(femalesNotInKeap.map((r) => r.id))}
            >
              {matching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Match {femalesNotInKeap.length} likely-female unlinked
            </Button>
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading and classifying contacts…
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <StatCard label="Likely female (ready)" value={females.length} tone="ready" />
            <StatCard label={`In Keap (pushable)`} value={femalesInKeap.length} tone="ready" />
            <StatCard label="Needs review (unknown/unisex)" value={unknowns.length} tone="review" />
            <StatCard label="Likely male (skipped)" value={males.length} tone="muted" />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" /> Auto-push queue — likely female
                </CardTitle>
                <CardDescription>
                  {females.length} likely female · {femalesInKeap.length} exist in Keap and will receive tag <strong>{tagId}</strong>. Contacts not in Keap are skipped automatically. Remove anyone you know isn't female by clicking the X.
                </CardDescription>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={femalesInKeap.length === 0 || pushing}>
                    {pushing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Push tag to {femalesInKeap.length} Keap contacts
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Push Keap tag {tagId}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will apply tag <strong>{tagId}</strong> ({tagLabel}) to {femalesInKeap.length} contacts
                      that already exist in Keap and are classified as likely female. Logged and reversible in Keap.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => pushTag(femalesInKeap.map((r) => r.id), "Auto push")}>
                      Push to Keap
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Search name or email…"
                value={femaleSearch}
                onChange={(e) => setFemaleSearch(e.target.value)}
                className="max-w-sm"
              />
              <div className="max-h-96 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>First name</TableHead>
                      <TableHead>Last name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>In Keap</TableHead>
                      <TableHead className="w-16 text-right">Remove</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFemales.slice(0, 1000).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.first_name}</TableCell>
                        <TableCell>{r.last_name}</TableCell>
                        <TableCell className="text-muted-foreground">{r.email}</TableCell>
                        <TableCell>
                          {r.inKeap
                            ? <Badge variant="secondary">Yes</Badge>
                            : <Badge variant="outline" className="text-muted-foreground">No</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFemaleExcluded((prev) => new Set(prev).add(r.id))}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredFemales.length > 1000 && (
                  <div className="p-2 text-xs text-muted-foreground">
                    Showing first 1000 of {filteredFemales.length}. All matching Keap contacts will be tagged on push.
                  </div>
                )}
              </div>
              {femaleExcluded.size > 0 && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  Removed {femaleExcluded.size} from queue.
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setFemaleExcluded(new Set())}>
                    Undo all
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Manual review — unknown / unisex names</CardTitle>
                <CardDescription>
                  Tick names you know are female, then push. First name couldn't be confidently classified.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={toggleAllUnknowns}>
                  {manualSelected.size === filteredUnknowns.length && filteredUnknowns.length > 0
                    ? "Deselect all" : "Select all (filtered)"}
                </Button>
                <Button
                  disabled={manualSelected.size === 0 || pushing}
                  onClick={() => pushTag(Array.from(manualSelected), "Manual review")}
                >
                  {pushing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Push tag to {manualSelected.size} selected
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Search name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
              <div className="max-h-[28rem] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>First name</TableHead>
                      <TableHead>Last name</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnknowns.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer"
                        onClick={() => toggleUnknown(r.id)}
                      >
                        <TableCell>
                          <Checkbox
                            checked={manualSelected.has(r.id)}
                            onCheckedChange={() => toggleUnknown(r.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell>{r.first_name}</TableCell>
                        <TableCell>{r.last_name}</TableCell>
                        <TableCell className="text-muted-foreground">{r.email}</TableCell>
                      </TableRow>
                    ))}
                    {filteredUnknowns.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                          No contacts need review.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {alreadyTagged.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  Already tagged <Badge variant="secondary">{alreadyTagged.length}</Badge>
                </CardTitle>
                <CardDescription>
                  These contacts already had tag {tagId} pushed from ART Admin. They're hidden from the queues above.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "ready" | "review" | "muted" }) {
  const toneClass =
    tone === "ready" ? "border-primary/40 bg-primary/5"
    : tone === "review" ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20"
    : "";
  return (
    <Card className={toneClass}>
      <CardContent className="pt-6">
        <div className="text-2xl font-semibold">{value.toLocaleString()}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}