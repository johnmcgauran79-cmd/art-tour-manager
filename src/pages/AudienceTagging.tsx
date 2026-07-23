import { useEffect, useMemo, useState } from "react";
import { getGender } from "gender-detection-from-name";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdminOrManager } from "@/hooks/useUserRoles";
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

type Row = Customer & { classification: Classification; alreadyTagged: boolean };

const BATCH = 25;

export default function AudienceTagging() {
  const { isAdminOrManager, isLoading: roleLoading } = useIsAdminOrManager();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [tagId, setTagId] = useState<string>("397");
  const [tagLabel, setTagLabel] = useState<string>("Females (Ladies Tour)");
  const [manualSelected, setManualSelected] = useState<Set<string>>(new Set());
  const [pushing, setPushing] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isAdminOrManager) return;
    (async () => {
      setLoading(true);
      try {
        // Load all customers with a Keap contact ID + first name
        const all: Customer[] = [];
        const pageSize = 1000;
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from("customers")
            .select("id, first_name, last_name, email, keap_contact_id")
            .not("keap_contact_id", "is", null)
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
          const g = raw ? getGender(raw) : "unknown";
          return {
            ...c,
            classification: (g === "male" || g === "female") ? g : "unknown",
            alreadyTagged: taggedSet.has(c.id),
          };
        });
        setRows(classified);
      } catch (e: any) {
        toast.error("Failed to load contacts", { description: e?.message });
      } finally {
        setLoading(false);
      }
    })();
     
  }, [isAdminOrManager, tagId]);

  const females = useMemo(() => rows.filter((r) => r.classification === "female" && !r.alreadyTagged), [rows]);
  const males = useMemo(() => rows.filter((r) => r.classification === "male"), [rows]);
  const unknowns = useMemo(() => rows.filter((r) => r.classification === "unknown" && !r.alreadyTagged), [rows]);
  const alreadyTagged = useMemo(() => rows.filter((r) => r.alreadyTagged), [rows]);

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
  if (!isAdminOrManager) {
    return <div className="p-6 text-sm text-muted-foreground">Admin/Manager access only.</div>;
  }

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

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading and classifying contacts…
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <StatCard label="Likely female (ready)" value={females.length} tone="ready" />
            <StatCard label="Needs review (unknown/unisex)" value={unknowns.length} tone="review" />
            <StatCard label="Likely male (skipped)" value={males.length} tone="muted" />
            <StatCard label="Already tagged" value={alreadyTagged.length} tone="muted" />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" /> Auto-push queue — likely female
                </CardTitle>
                <CardDescription>
                  {females.length} contacts. Confirm to push tag <strong>{tagId}</strong> to all of them in Keap.
                </CardDescription>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={females.length === 0 || pushing}>
                    {pushing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Push tag to {females.length} contacts
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Push Keap tag {tagId}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will apply tag <strong>{tagId}</strong> ({tagLabel}) to {females.length} Keap
                      contacts classified as likely female. This action is logged and can be undone in Keap by removing the tag.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => pushTag(females.map((r) => r.id), "Auto push")}>
                      Push to Keap
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardHeader>
            <CardContent>
              <div className="max-h-72 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>First name</TableHead>
                      <TableHead>Last name</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {females.slice(0, 500).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.first_name}</TableCell>
                        <TableCell>{r.last_name}</TableCell>
                        <TableCell className="text-muted-foreground">{r.email}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {females.length > 500 && (
                  <div className="p-2 text-xs text-muted-foreground">
                    Showing first 500 of {females.length}. All will be tagged on push.
                  </div>
                )}
              </div>
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