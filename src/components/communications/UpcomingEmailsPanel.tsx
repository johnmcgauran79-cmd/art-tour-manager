import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarClock, Search, Users, Zap, Calendar, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  useUpcomingEmails,
  type UpcomingEmailRow,
  type UpcomingStatus,
} from "@/hooks/useUpcomingEmails";

interface Props {
  /** Lock the panel to a single tour. */
  tourId?: string | null;
  /** Hide the tour column (tour-scoped views). */
  hideTourColumn?: boolean;
}

const statusBadge = (status: UpcomingStatus) => {
  switch (status) {
    case "Awaiting approval":
      return (
        <Badge
          variant="outline"
          className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
        >
          Awaiting approval
        </Badge>
      );
    case "Approved":
      return <Badge variant="secondary">Approved</Badge>;
    case "Scheduled":
      return (
        <Badge
          variant="outline"
          className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
        >
          Scheduled
        </Badge>
      );
    default:
      return <Badge variant="outline">Forecast</Badge>;
  }
};

const sourceBadge = (row: UpcomingEmailRow) => {
  if (row.source === "status_change")
    return (
      <Badge variant="outline">
        <Zap className="h-3 w-3 mr-1" />
        Status change
      </Badge>
    );
  if (row.source === "one_off")
    return (
      <Badge variant="outline">
        <Mail className="h-3 w-3 mr-1" />
        One-off
      </Badge>
    );
  return (
    <Badge variant="outline">
      <Calendar className="h-3 w-3 mr-1" />
      Automated
    </Badge>
  );
};

export const UpcomingEmailsPanel = ({ tourId = null, hideTourColumn = false }: Props) => {
  const [window, setWindow] = useState<"14" | "30" | "90" | "all">("14");
  const [statusFilter, setStatusFilter] = useState<"all" | "approval" | "confirmed">("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useUpcomingEmails({
    tourId,
    daysAhead: window === "all" ? null : Number(window),
  });

  const rows = useMemo(() => {
    let out = data || [];
    if (statusFilter === "approval")
      out = out.filter((r) => r.status === "Awaiting approval");
    else if (statusFilter === "confirmed")
      out = out.filter((r) => r.status === "Approved" || r.status === "Scheduled");
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (r) =>
          (r.tourName || "").toLowerCase().includes(q) ||
          (r.templateName || "").toLowerCase().includes(q) ||
          (r.ruleName || "").toLowerCase().includes(q)
      );
    }
    return out;
  }, [data, statusFilter, search]);

  const colSpan = hideTourColumn ? 5 : 6;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={window} onValueChange={(v) => setWindow(v as any)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="14">Next 14 days</SelectItem>
            <SelectItem value="30">Next 30 days</SelectItem>
            <SelectItem value="90">Next 90 days</SelectItem>
            <SelectItem value="all">All upcoming</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All upcoming emails</SelectItem>
            <SelectItem value="approval">Awaiting approval</SelectItem>
            <SelectItem value="confirmed">Approved / scheduled</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tour, rule or template..."
            className="pl-8"
          />
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[130px]">Due</TableHead>
              <TableHead className="w-[130px]">Type</TableHead>
              {!hideTourColumn && <TableHead>Tour</TableHead>}
              <TableHead>Rule / Template</TableHead>
              <TableHead className="w-[130px]">Recipients</TableHead>
              <TableHead className="w-[170px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={colSpan}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  className="text-center text-sm text-muted-foreground py-8"
                >
                  <CalendarClock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No emails due in this period.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {row.hasTime
                      ? format(new Date(row.dueAt), "dd/MM/yyyy HH:mm")
                      : format(new Date(`${row.dueAt.slice(0, 10)}T00:00:00`), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>{sourceBadge(row)}</TableCell>
                  {!hideTourColumn && (
                    <TableCell className="text-sm">
                      {row.tourName || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  )}
                  <TableCell className="text-sm max-w-[280px]">
                    <div className="truncate font-medium">{row.ruleName || "—"}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {row.templateName || "Template not set"}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.recipientCount > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {row.recipientCount}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">TBC</span>
                    )}
                  </TableCell>
                  <TableCell>{statusBadge(row.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
