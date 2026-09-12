import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  CheckCircle2,
  HeartPulse,
  Mail,
  RefreshCw,
  Send,
} from "lucide-react";
import { useSystemHealth, useSendHealthDigest, type SystemHealthJob } from "@/hooks/useSystemHealth";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const okTone = "bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200";
const badTone = "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200";
const warnTone = "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-200";

const formatWhen = (iso: string | null) => {
  if (!iso) return "Never";
  const d = new Date(iso);
  return `${formatDateToDDMMYYYY(iso)} ${d.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const jobStatus = (job: SystemHealthJob) => {
  if (!job.active) return { label: "Paused", tone: warnTone };
  if (job.failures_24h > 0) return { label: `${job.failures_24h} failed`, tone: badTone };
  if (!job.last_run) return { label: "Not run yet", tone: warnTone };
  return { label: "Running", tone: okTone };
};

export const SystemHealthCard = () => {
  const { data, isLoading, isFetching, refetch, error } = useSystemHealth();
  const sendDigest = useSendHealthDigest();
  const { toast } = useToast();

  const problems = data?.problem_count ?? 0;
  const backupHours = data?.backup.hours_since_success ?? null;
  const backupStale = backupHours === null || backupHours > (data?.backup.stale_after_hours ?? 36);

  const handleSend = async () => {
    try {
      const res = await sendDigest.mutateAsync();
      toast({
        title: "Health digest sent",
        description: `Sent to ${res?.sent ?? 0} administrator(s).`,
      });
    } catch (e) {
      toast({
        title: "Could not send the digest",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5" />
              System Health
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Automatic checks on background jobs, mailbox syncing, backups and failed emails.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={problems === 0 ? okTone : badTone}>
              {problems === 0 ? (
                <CheckCircle2 className="mr-1 h-3 w-3" />
              ) : (
                <AlertTriangle className="mr-1 h-3 w-3" />
              )}
              {problems === 0 ? "All clear" : `${problems} to check`}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleSend} disabled={sendDigest.isPending}>
              <Send className="mr-2 h-4 w-4" />
              {sendDigest.isPending ? "Sending…" : "Email me a digest"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? (
          <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Could not load system health."}
          </div>
        ) : isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : !data ? null : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">Last successful backup</div>
                <div className={`text-sm font-semibold ${backupStale ? "text-destructive" : ""}`}>
                  {data.backup.last_run && backupHours !== null
                    ? `${Math.round(backupHours)} hours ago`
                    : "Never reported"}
                </div>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">Failed emails (24h)</div>
                <div className="text-sm font-semibold tabular-nums">{data.failures_24h.emails}</div>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">Xero sync errors (24h)</div>
                <div className="text-sm font-semibold tabular-nums">{data.failures_24h.xero_sync}</div>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">Automation errors (24h)</div>
                <div className="text-sm font-semibold tabular-nums">
                  {data.failures_24h.crm_automation + data.failures_24h.marketing_automation}
                </div>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">Scheduled jobs</h4>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Runs</TableHead>
                      <TableHead>Last run</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.jobs.map((job) => {
                      const s = jobStatus(job);
                      return (
                        <TableRow key={job.jobname}>
                          <TableCell className="text-sm font-medium">{job.jobname}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {job.schedule}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{formatWhen(job.last_run)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={s.tone}>
                              {s.label}
                            </Badge>
                            {job.failures_24h > 0 && job.last_message && (
                              <div className="mt-1 max-w-xs text-xs text-destructive">{job.last_message}</div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Mail className="h-4 w-4" />
                Mailbox syncing
              </h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.mailboxes.map((m) => {
                  const bad = m.enabled && !["success", "completed"].includes(m.last_status || "");
                  return (
                    <div key={m.mailbox} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{m.mailbox}</span>
                        <Badge variant="outline" className={!m.enabled ? warnTone : bad ? badTone : okTone}>
                          {!m.enabled ? "Off" : bad ? m.last_status || "No runs" : "Synced"}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Last sync: {formatWhen(m.last_finished)}
                      </div>
                      {m.last_error && <div className="mt-1 text-xs text-destructive">{m.last_error}</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Checked {formatWhen(data.generated_at)}. A digest email goes to administrators each morning, and only
              when something looks wrong.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};
