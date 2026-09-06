import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubmissionDetailDialog } from "@/components/crm/SubmissionDetailDialog";
import {
  useFormSubmissions,
  useReprocessSubmission,
  type FormSubmission,
} from "@/hooks/useFormSubmissions";

const ALL = "__all__";

/** Recent website form submissions, with a needs-attention view and retry. */
export function SubmissionsTab() {
  const [view, setView] = useState<"all" | "review">("all");
  const [formType, setFormType] = useState(ALL);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<FormSubmission | null>(null);

  const { data: rows = [], isLoading } = useFormSubmissions({
    formType: formType === ALL ? undefined : formType,
    search,
  });
  const reprocess = useReprocessSubmission();

  const needsAttention = useMemo(
    () => rows.filter((r) => r.needs_review || r.processing_status !== "processed"),
    [rows]
  );
  const shown = view === "review" ? needsAttention : rows;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Every enquiry sent from the website, exactly as it arrived. Nothing is lost — anything that
          failed can be processed again from here.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email…"
              className="w-56 pl-8"
            />
          </div>
          <Select value={formType} onValueChange={setFormType}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All forms</SelectItem>
              <SelectItem value="interest">Register interest</SelectItem>
              <SelectItem value="booking">Booking form</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as any)}>
        <TabsList>
          <TabsTrigger value="all">All submissions ({rows.length})</TabsTrigger>
          <TabsTrigger value="review" className="gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Needs attention ({needsAttention.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Enquiry</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    Loading submissions…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && shown.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    Nothing here.
                  </TableCell>
                </TableRow>
              )}
              {shown.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(s)}
                >
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {format(new Date(s.created_at), "dd/MM/yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="font-medium">
                      {`${s.first_name || ""} ${s.last_name || ""}`.trim() || "—"}
                    </div>
                    <div className="text-muted-foreground">{s.email}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <Badge variant={s.form_type === "booking" ? "default" : "secondary"}>
                      {s.form_type === "booking" ? "Booking" : "Interest"}
                    </Badge>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {s.landing_page?.title}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.utm_source || s.referrer || "direct"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {s.processing_status === "processed" && !s.needs_review ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Done
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {s.processing_status === "processed" ? "Check" : "Failed"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {s.lead_id ? (
                      <Link
                        to={`/leads/${s.lead_id}`}
                        className="underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {(s.needs_review || s.processing_status !== "processed") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        disabled={reprocess.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          reprocess.mutate(s.id);
                        }}
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Retry
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SubmissionDetailDialog
        submission={selected}
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
      />
    </div>
  );
}
