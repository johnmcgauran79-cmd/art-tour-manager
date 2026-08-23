import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  MapPin,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { ConfirmDeleteFileDialog } from "@/components/shared/ConfirmDeleteFileDialog";
import {
  useBrevoLocationBackfill,
  useBrevoPurgeBlocklisted,
  useBrevoPullNew,
  useBrevoStatus,
  useLatestMigrationRun,
  useMigrationReport,
  useMigrationRunner,
  useUpdateTagMapping,
  type CrmTagMapping,
} from "@/hooks/useCrmMigration";
import { usePermissions } from "@/hooks/usePermissions";
import { downloadCsv, exportStamp } from "@/lib/csvExport";

const STEPS = [
  { key: "collect", label: "1. Collect from Keap" },
  { key: "review", label: "2. Review & map tags" },
  { key: "send", label: "3. Send to Brevo" },
];

const Stat = ({ label, value, tone }: { label: string; value: number | string; tone?: "warn" | "good" }) => (
  <div className="rounded-lg border p-3">
    <div
      className={`text-2xl font-semibold ${
        tone === "warn" ? "text-destructive" : tone === "good" ? "text-primary" : ""
      }`}
    >
      {value}
    </div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </div>
);

export const CrmMigrationConsole = () => {
  const { userRole } = usePermissions();
  const canManage = userRole === "admin" || userRole === "manager";

  const { data: run, isLoading: runLoading } = useLatestMigrationRun();
  const { data: report, isLoading: reportLoading, refetch: refetchReport } = useMigrationReport(run?.id);
  const { data: brevo, refetch: refetchBrevo, isFetching: brevoFetching } = useBrevoStatus();
  const { busy, progressLabel, startRun, runPull, runPush, retryFailed, stop } = useMigrationRunner();
  const updateTag = useUpdateTagMapping();
  const pullNew = useBrevoPullNew();
  const locationBackfill = useBrevoLocationBackfill();
  const purgeBlocked = useBrevoPurgeBlocklisted();

  const [confirmPurge, setConfirmPurge] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [tab, setTab] = useState("collect");

  const summary = report?.summary;
  const pushProgress = summary && summary.total > 0
    ? Math.round(((summary.pushed + summary.skipped) / summary.total) * 100)
    : 0;

  const tags = useMemo(() => {
    const list = report?.tags ?? [];
    const q = tagSearch.trim().toLowerCase();
    const filtered = q
      ? list.filter((t) => (t.keap_tag_name ?? "").toLowerCase().includes(q))
      : list;
    return filtered.filter((t) => (t.contact_count ?? 0) > 0).slice(0, 300);
  }, [report?.tags, tagSearch]);

  if (!canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>CRM Migration</CardTitle>
          <CardDescription>
            Only an administrator or manager can run the CRM migration.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleStart = async () => {
    const created = await startRun();
    if (created) await runPull(created.id);
  };

  const exportTagDecisions = () => {
    downloadCsv(
      `keap-tag-decisions-${exportStamp()}.csv`,
      report?.tags ?? [],
      [
        { header: "Keap tag", value: (t) => t.keap_tag_name },
        { header: "Category", value: (t) => t.keap_tag_category ?? "" },
        { header: "Contacts", value: (t) => t.contact_count ?? 0 },
        { header: "Goes to", value: (t) => t.target_type },
        { header: "Name in Brevo", value: (t) => t.target_name ?? t.keap_tag_name },
      ],
    );
  };

  const exportProblems = () => {
    const rows = [
      ...(report?.noEmailSample ?? []).map((r) => ({
        Issue: "No email address",
        Contact: r.name,
        Detail: r.phone ?? "",
      })),
      ...(report?.duplicates ?? []).map((d) => ({
        Issue: "Duplicate email",
        Contact: d.names.join(" / "),
        Detail: `${d.email} (${d.count} records)`,
      })),
      ...(report?.failures ?? []).map((f) => ({
        Issue: "Failed to send",
        Contact: f.email ?? "",
        Detail: f.error_message ?? "",
      })),
    ];
    downloadCsv(`crm-migration-issues-${exportStamp()}.csv`, rows, [
      { header: "Issue", value: (r) => r.Issue },
      { header: "Contact", value: (r) => r.Contact },
      { header: "Detail", value: (r) => r.Detail },
    ]);
  };

  return (
    <div className="space-y-4">
      {/* Brevo connection state */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Brevo connection
              </CardTitle>
              <CardDescription>
                {brevo?.connected
                  ? `Connected${brevo.company ? ` to ${brevo.company}` : ""} — ${brevo.linkedContacts} of ${brevo.totalContacts} contacts linked.`
                  : brevo?.reason ?? "Checking the connection…"}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetchBrevo()} disabled={brevoFetching}>
                <RefreshCw className={`h-4 w-4 mr-1.5 ${brevoFetching ? "animate-spin" : ""}`} />
                Check
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pullNew.mutate()}
                disabled={!brevo?.connected || pullNew.isPending}
              >
                {pullNew.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-1.5" />
                )}
                Bring in new Brevo contacts
              </Button>
            </div>
          </div>
        </CardHeader>
        {!brevo?.connected && (
          <CardContent>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Brevo is not connected yet</AlertTitle>
              <AlertDescription>
                You can still collect and review everything from Keap. The final step — sending
                contacts to Brevo — becomes available once the Brevo account is connected.
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      {/* Brevo housekeeping */}
      <Card>
        <CardHeader>
          <CardTitle>Brevo housekeeping</CardTitle>
          <CardDescription>
            Tidy up the Brevo database after the migration. Both actions run against Brevo only —
            nothing in ART is changed apart from the stored Brevo id.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-3 space-y-2">
            <div className="font-medium">State / City / Country fields</div>
            <p className="text-sm text-muted-foreground">
              Brevo has no State field of its own, so those values were dropped during the import.
              This creates STATE, CITY, COUNTRY and LATEST_TOUR in Brevo and fills them from ART, so
              you can build segments by state.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => locationBackfill.mutate()}
              disabled={!brevo?.connected || locationBackfill.isPending}
            >
              {locationBackfill.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4 mr-1.5" />
              )}
              Add & fill location fields
            </Button>
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <div className="font-medium">Delete blocked / unsubscribed contacts</div>
            <p className="text-sm text-muted-foreground">
              Permanently removes every contact Brevo has marked as blocked (unsubscribed, bounced
              or complained). They cannot be emailed either way, and deleting them removes the
              record that they opted out — so if they are ever imported again, nothing stops them
              being contacted. Keeping them blocked is the safer option.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => setConfirmPurge(true)}
              disabled={!brevo?.connected || purgeBlocked.isPending}
            >
              {purgeBlocked.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1.5" />
              )}
              Delete blocked contacts
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDeleteFileDialog
        open={confirmPurge}
        onOpenChange={setConfirmPurge}
        itemLabel="group of blocked contacts"
        isPending={purgeBlocked.isPending}
        onConfirm={() => {
          setConfirmPurge(false);
          purgeBlocked.mutate();
        }}
      />


      {/* Migration wizard */}
      <Card>
        <CardHeader>
          <CardTitle>Keap → Brevo migration</CardTitle>
          <CardDescription>
            A one-off, three-step move. Nothing is changed in Keap, and nothing reaches Brevo until
            you press send on step 3.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                <Badge variant={tab === s.key ? "default" : "secondary"}>{s.label}</Badge>
                {i < STEPS.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              </div>
            ))}
          </div>

          {busy && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Working…</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>{progressLabel ?? "In progress"}</span>
                <Button variant="outline" size="sm" onClick={stop}>
                  Stop
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {run?.last_error && !busy && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Last attempt reported a problem</AlertTitle>
              <AlertDescription>{run.last_error}</AlertDescription>
            </Alert>
          )}

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              {STEPS.map((s) => (
                <TabsTrigger key={s.key} value={s.key}>
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Step 1 — collect */}
            <TabsContent value="collect" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                This reads every contact out of Keap, along with their tags and notes, and stores a
                copy inside this system. It is safe to stop and resume — it picks up where it left
                off.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Contacts read" value={run?.total_pulled ?? 0} />
                <Stat label="Tags found" value={run?.tags_pulled ?? 0} />
                <Stat label="Notes collected" value={run?.notes_pulled ?? 0} />
                <Stat label="Stage" value={run?.phase ?? "not started"} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleStart} disabled={busy || runLoading}>
                  {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                  Start a fresh collection
                </Button>
                {run && (
                  <Button
                    variant="outline"
                    onClick={() => runPull(run.id)}
                    disabled={busy}
                  >
                    Resume collection
                  </Button>
                )}
                {run && (
                  <Button variant="ghost" onClick={() => setTab("review")}>
                    Go to review
                  </Button>
                )}
              </div>
            </TabsContent>

            {/* Step 2 — review */}
            <TabsContent value="review" className="space-y-4 pt-4">
              {!run ? (
                <p className="text-sm text-muted-foreground">
                  Collect the Keap data first.
                </p>
              ) : reportLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Building the review…
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Stat label="Contacts collected" value={summary?.total ?? 0} />
                    <Stat label="Ready to send" value={summary?.pushable ?? 0} tone="good" />
                    <Stat label="No email (stay in ART only)" value={summary?.noEmail ?? 0} tone="warn" />
                    <Stat label="Duplicate emails (will merge)" value={summary?.duplicateContacts ?? 0} tone="warn" />
                    <Stat label="Unsubscribed (blocked in Brevo)" value={summary?.blocklisted ?? 0} />
                    <Stat label="Contacts with notes" value={summary?.withNotes ?? 0} />
                    <Stat label="Already in ART contacts" value={summary?.matchedInArt ?? 0} />
                    <Stat label="Tags still undecided" value={summary?.undecidedTags ?? 0} tone="warn" />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetchReport()}>
                      <RefreshCw className="h-4 w-4 mr-1.5" />
                      Refresh review
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportProblems}>
                      <Download className="h-4 w-4 mr-1.5" />
                      Download issues list
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportTagDecisions}>
                      <Download className="h-4 w-4 mr-1.5" />
                      Download tag decisions
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <h3 className="font-medium">Where should each Keap tag go?</h3>
                        <p className="text-sm text-muted-foreground">
                          A <strong>list</strong> is a marketing audience you can send campaigns to.
                          A <strong>field</strong> just records the fact against the contact.
                          <strong> Don't move</strong> leaves the tag behind.
                        </p>
                      </div>
                      <Input
                        placeholder="Search tags…"
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        className="w-full sm:w-64"
                      />
                    </div>

                    <ScrollArea className="h-[360px] rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Keap tag</TableHead>
                            <TableHead className="w-24">Contacts</TableHead>
                            <TableHead className="w-44">Goes to</TableHead>
                            <TableHead>Name in Brevo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tags.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground">
                                No tags in use for the collected contacts.
                              </TableCell>
                            </TableRow>
                          )}
                          {tags.map((t: CrmTagMapping) => (
                            <TableRow key={t.keap_tag_id}>
                              <TableCell className="font-medium">
                                {t.keap_tag_name}
                                {t.keap_tag_category && (
                                  <div className="text-xs text-muted-foreground">
                                    {t.keap_tag_category}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>{t.contact_count ?? 0}</TableCell>
                              <TableCell>
                                <Select
                                  value={t.target_type}
                                  onValueChange={(value) =>
                                    updateTag.mutate({
                                      keapTagId: t.keap_tag_id,
                                      targetType: value as CrmTagMapping["target_type"],
                                      targetName: t.target_name ?? t.keap_tag_name,
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="list">Brevo list</SelectItem>
                                    <SelectItem value="attribute">Contact field</SelectItem>
                                    <SelectItem value="skip">Don't move</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  defaultValue={t.target_name ?? t.keap_tag_name}
                                  onBlur={(e) => {
                                    const next = e.target.value.trim();
                                    if (next && next !== (t.target_name ?? t.keap_tag_name)) {
                                      updateTag.mutate({
                                        keapTagId: t.keap_tag_id,
                                        targetType: t.target_type,
                                        targetName: next,
                                      });
                                    }
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>

                  {(report?.duplicates?.length ?? 0) > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>{report!.duplicates.length} email addresses appear more than once</AlertTitle>
                      <AlertDescription>
                        Brevo keeps one contact per email address, so these will merge into a single
                        record each. The first record wins; the rest are marked as merged and left in
                        ART untouched.
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button onClick={() => setTab("send")}>
                    Looks right — continue
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </>
              )}
            </TabsContent>

            {/* Step 3 — send */}
            <TabsContent value="send" className="space-y-4 pt-4">
              {!run ? (
                <p className="text-sm text-muted-foreground">Collect the Keap data first.</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    This creates the chosen lists and fields in Brevo, then adds or updates each
                    contact. Anyone unsubscribed in Keap is added as blocked in Brevo so they cannot
                    be emailed by mistake. Notes travel across as a single "Keap notes" field and are
                    also saved to the contact's notes in ART.
                  </p>

                  <Progress value={pushProgress} />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Stat label="Sent to Brevo" value={run.total_pushed ?? 0} tone="good" />
                    <Stat label="Skipped" value={run.total_skipped ?? 0} />
                    <Stat label="Failed" value={run.total_failed ?? 0} tone="warn" />
                    <Stat label="Stage" value={run.phase} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => runPush(run.id)}
                      disabled={busy || !brevo?.connected}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-1.5" />
                      )}
                      Send contacts to Brevo
                    </Button>
                    {(run.total_failed ?? 0) > 0 && (
                      <Button variant="outline" onClick={() => retryFailed(run.id)} disabled={busy}>
                        Try the failures again
                      </Button>
                    )}
                  </div>

                  {run.phase === "complete" && (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Migration complete</AlertTitle>
                      <AlertDescription>
                        Brevo is now the home of your marketing contacts. Use "Bring in new Brevo
                        contacts" above to pull in any new sign-ups.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
