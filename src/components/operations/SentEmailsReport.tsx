import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Mail,
  MailOpen,
  MailCheck,
  AlertTriangle,
  Users,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSentEmailsReport,
  type SentEmailsRange,
  type SentEmailRow,
  type BulkEmailRow,
} from "@/hooks/useSentEmailsReport";

interface SentEmailsReportProps {
  /** When provided, locks the report to a single tour. */
  tourId?: string | null;
}

const StatusBadge = ({
  label,
}: {
  label: "Sent" | "Delivered" | "Opened" | "Bounced" | "Complained" | "Failed";
}) => {
  const map: Record<
    typeof label,
    { variant: "default" | "secondary" | "destructive" | "outline"; cls: string }
  > = {
    Sent: { variant: "secondary", cls: "" },
    Delivered: { variant: "secondary", cls: "" },
    Opened: {
      variant: "outline",
      cls:
        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    },
    Bounced: { variant: "destructive", cls: "" },
    Complained: { variant: "destructive", cls: "" },
    Failed: { variant: "destructive", cls: "" },
  };
  const { variant, cls } = map[label];
  return (
    <Badge variant={variant} className={cls}>
      {label}
    </Badge>
  );
};

const BulkRowDetails = ({ row }: { row: BulkEmailRow }) => {
  return (
    <div className="bg-muted/30 border rounded-md p-3 space-y-1 text-sm">
      <div className="font-medium mb-2">Recipients ({row.logs.length})</div>
      <div className="max-h-64 overflow-y-auto space-y-1">
        {row.logs.map((l) => {
          const events = l.email_events || [];
          const types = new Set(events.map((e) => e.event_type));
          const status: any = l.error_message
            ? "Failed"
            : types.has("bounced")
            ? "Bounced"
            : types.has("complained")
            ? "Complained"
            : types.has("opened")
            ? "Opened"
            : types.has("delivered")
            ? "Delivered"
            : "Sent";
          return (
            <div
              key={l.id}
              className="flex items-center justify-between gap-2 py-1 border-b last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate">
                  {l.recipient_name || l.recipient_email}
                </div>
                {l.recipient_name && (
                  <div className="text-xs text-muted-foreground truncate">
                    {l.recipient_email}
                  </div>
                )}
                {l.error_message && (
                  <div className="text-xs text-destructive truncate">
                    {l.error_message}
                  </div>
                )}
              </div>
              <StatusBadge label={status} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const SentEmailsReport = ({ tourId }: SentEmailsReportProps) => {
  const [range, setRange] = useState<SentEmailsRange>("7d");
  const [statusFilter, setStatusFilter] = useState<"all" | "issues" | "opened">(
    "all"
  );
  const [search, setSearch] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const { data, isLoading } = useSentEmailsReport({ range, tourId });

  const filteredRows = useMemo<SentEmailRow[]>(() => {
    if (!data) return [];
    let rows = data.rows;
    if (statusFilter === "issues") {
      rows = rows.filter((r) =>
        r.kind === "bulk" ? r.hasIssue : r.status.hasIssue
      );
    } else if (statusFilter === "opened") {
      rows = rows.filter((r) =>
        r.kind === "bulk" ? r.opened > 0 : r.status.opened
      );
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => {
        const tourMatch = (r.tourName || "").toLowerCase().includes(q);
        const tplMatch = (r.templateName || "").toLowerCase().includes(q);
        const subjMatch = (r.subject || "").toLowerCase().includes(q);
        const recipMatch =
          r.kind === "individual" &&
          (r.recipientEmail.toLowerCase().includes(q) ||
            (r.recipientName || "").toLowerCase().includes(q));
        return tourMatch || tplMatch || subjMatch || recipMatch;
      });
    }
    return rows;
  }, [data, statusFilter, search]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={range} onValueChange={(v) => setRange(v as SentEmailsRange)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All emails</SelectItem>
            <SelectItem value="issues">Issues only</SelectItem>
            <SelectItem value="opened">Opened</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tour, template, subject, recipient..."
            className="pl-8"
          />
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border rounded-lg p-3">
          <div className="text-xs text-muted-foreground">Total emails</div>
          <div className="text-2xl font-semibold">
            {isLoading ? "—" : data?.summary.totalEmails ?? 0}
          </div>
        </div>
        <div className="border rounded-lg p-3">
          <div className="text-xs text-muted-foreground">Bulk sends</div>
          <div className="text-2xl font-semibold">
            {isLoading ? "—" : data?.summary.totalBulkSends ?? 0}
          </div>
        </div>
        <div className="border rounded-lg p-3">
          <div className="text-xs text-muted-foreground">Individual sends</div>
          <div className="text-2xl font-semibold">
            {isLoading ? "—" : data?.summary.totalIndividualSends ?? 0}
          </div>
        </div>
        <div className="border rounded-lg p-3">
          <div className="text-xs text-muted-foreground">Issues</div>
          <div className="text-2xl font-semibold text-destructive">
            {isLoading ? "—" : data?.summary.totalIssues ?? 0}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Sent</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Tour</TableHead>
              <TableHead>Template / Subject</TableHead>
              <TableHead>Recipient(s)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[40px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-sm text-muted-foreground py-8"
                >
                  <Mail className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No emails sent in the selected period.
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => {
                const isExpanded = expandedKey === row.key;
                const isBulk = row.kind === "bulk";
                return (
                  <>
                    <TableRow key={row.key}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(row.sentAt), "d MMM HH:mm")}
                      </TableCell>
                      <TableCell>
                        {isBulk ? (
                          <Badge
                            variant="outline"
                            className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                          >
                            <Users className="h-3 w-3 mr-1" />
                            Bulk
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <Mail className="h-3 w-3 mr-1" />
                            Individual
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.tourName || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm max-w-[260px]">
                        <div className="truncate font-medium">
                          {row.templateName || "—"}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {row.subject}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {isBulk ? (
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {row.recipientCount} recipients
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {row.opened}/{row.delivered || row.recipientCount}{" "}
                              opened ({row.openRate}%)
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col min-w-0">
                            <span className="truncate">
                              {row.recipientName || row.recipientEmail}
                            </span>
                            {row.recipientName && (
                              <span className="text-xs text-muted-foreground truncate">
                                {row.recipientEmail}
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {isBulk ? (
                          <div className="flex flex-wrap gap-1">
                            {row.opened > 0 && (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                              >
                                <MailOpen className="h-3 w-3 mr-1" />
                                {row.opened} opened
                              </Badge>
                            )}
                            {row.delivered > 0 && row.opened === 0 && (
                              <Badge variant="secondary">
                                <MailCheck className="h-3 w-3 mr-1" />
                                {row.delivered} delivered
                              </Badge>
                            )}
                            {row.bounced > 0 && (
                              <Badge variant="destructive">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {row.bounced} bounced
                              </Badge>
                            )}
                            {row.failed > 0 && (
                              <Badge variant="destructive">
                                {row.failed} failed
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <StatusBadge label={row.status.label} />
                            {row.errorMessage && (
                              <span className="text-xs text-destructive truncate max-w-[180px]">
                                {row.errorMessage}
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {isBulk && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              setExpandedKey(isExpanded ? null : row.key)
                            }
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && isBulk && (
                      <TableRow key={`${row.key}-detail`}>
                        <TableCell colSpan={7} className="bg-muted/20">
                          <BulkRowDetails row={row} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
