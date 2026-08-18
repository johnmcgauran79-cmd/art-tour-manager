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
import { AlertTriangle, CheckCircle2, DatabaseBackup, HelpCircle, RefreshCw, XCircle } from "lucide-react";
import {
  BACKUP_STALE_HOURS,
  backupHealth,
  formatBytes,
  formatDuration,
  useBackupRuns,
  type BackupHealth,
} from "@/hooks/useBackupRuns";
import { formatDateToDDMMYYYY } from "@/lib/utils";

const healthMeta: Record<BackupHealth, { label: string; className: string; Icon: typeof CheckCircle2; hint: string }> = {
  healthy: {
    label: "Healthy",
    className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200",
    Icon: CheckCircle2,
    hint: "A backup completed successfully within the last day.",
  },
  stale: {
    label: "Stale",
    className: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-200",
    Icon: AlertTriangle,
    hint: `No successful backup in the last ${BACKUP_STALE_HOURS} hours.`,
  },
  failing: {
    label: "Failing",
    className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200",
    Icon: XCircle,
    hint: "The most recent backup run reported a failure.",
  },
  none: {
    label: "Not reporting",
    className: "bg-muted text-muted-foreground border-border",
    Icon: HelpCircle,
    hint: "No backup runs have been reported yet.",
  },
};

const statusTone = (status: string) =>
  status === "success"
    ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
    : status === "failed"
    ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
    : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";

const formatWhen = (iso: string) => {
  const d = new Date(iso);
  return `${formatDateToDDMMYYYY(iso)} ${d.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

export const BackupStatusCard = () => {
  const { data = [], isLoading, isFetching, refetch } = useBackupRuns(15);
  const health = backupHealth(data);
  const meta = healthMeta[health];
  const lastSuccess = data.find((r) => r.status === "success");

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DatabaseBackup className="h-5 w-5" />
              Backup Reporting
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{meta.hint}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={meta.className}>
              <meta.Icon className="mr-1 h-3 w-3" />
              {meta.label}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">Last successful backup</div>
            <div className="text-sm font-semibold">
              {isLoading ? "…" : lastSuccess ? formatWhen(lastSuccess.finished_at) : "Never"}
            </div>
          </div>
          <div className="rounded-md border bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">Size</div>
            <div className="text-sm font-semibold tabular-nums">
              {isLoading ? "…" : formatBytes(lastSuccess?.size_bytes ?? null)}
            </div>
          </div>
          <div className="rounded-md border bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">Stored at</div>
            <div className="truncate text-sm font-semibold">
              {isLoading ? "…" : lastSuccess?.destination || "—"}
            </div>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : data.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No backup runs reported yet. Once the scheduled backup job posts to the{" "}
            <code className="rounded bg-muted px-1">backup-report</code> endpoint, each run will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Finished</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Destination</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="whitespace-nowrap text-sm">{formatWhen(run.finished_at)}</TableCell>
                    <TableCell className="text-sm capitalize">{run.kind}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusTone(run.status)}>
                        {run.status}
                      </Badge>
                      {run.error_message && (
                        <div className="mt-1 max-w-xs text-xs text-destructive">{run.error_message}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{formatBytes(run.size_bytes)}</TableCell>
                    <TableCell className="text-sm tabular-nums">{formatDuration(run.duration_seconds)}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                      {run.destination || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};