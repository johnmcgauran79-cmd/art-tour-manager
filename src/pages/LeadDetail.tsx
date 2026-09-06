import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft,
  CalendarClock,
  Mail,
  Pencil,
  Phone,
  PhoneCall,
  StickyNote,
  Trash2,
  User,
} from "lucide-react";
import { AppBreadcrumbs } from "@/components/shared/AppBreadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { LeadDialog } from "@/components/crm/LeadDialog";
import { LogActivityDialog } from "@/components/crm/LogActivityDialog";
import { CrmActivityFeed } from "@/components/crm/CrmActivityFeed";
import { RelatedTasksSection } from "@/components/entityLinks/RelatedTasksSection";
import {
  useCrmConfig,
  useDeleteLead,
  useLead,
  useLeadStageHistory,
  useUpdateLead,
} from "@/hooks/useCrm";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";
import { labelFor, priorityBadgeClass, LEAD_PRIORITIES } from "@/lib/crm/constants";

const NONE = "__none__";

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: lead, isLoading } = useLead(id);
  const { data: config } = useCrmConfig();
  const { data: history = [] } = useLeadStageHistory(id);
  const { data: users = [] } = useAssignableUsers();
  const update = useUpdateLead();
  const remove = useDeleteLead();

  const [editOpen, setEditOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logType, setLogType] = useState("call");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading enquiry…</div>;
  }
  if (!lead) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm text-muted-foreground">That enquiry no longer exists.</p>
        <Button asChild variant="outline">
          <Link to="/leads"><ArrowLeft className="mr-1 h-4 w-4" /> Back to leads</Link>
        </Button>
      </div>
    );
  }

  const name = `${lead.customer?.first_name || ""} ${lead.customer?.last_name || ""}`.trim() || "Unnamed contact";
  const stage = config?.stages.find((s) => s.key === lead.stage);
  const openLog = (type: string) => {
    setLogType(type);
    setLogOpen(true);
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <AppBreadcrumbs items={[{ label: "Leads", href: "/leads" }, { label: name }]} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <User className="h-6 w-6" /> {name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {stage && (
              <Badge style={{ backgroundColor: stage.color, color: "#fff" }}>{stage.label}</Badge>
            )}
            <Badge className={priorityBadgeClass(lead.priority)}>
              {labelFor(LEAD_PRIORITIES, lead.priority)}
            </Badge>
            <Badge variant="outline">{labelFor(config?.types || [], lead.lead_type, "key", "label")}</Badge>
            {lead.tour?.name && <Badge variant="outline">{lead.tour.name}</Badge>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => openLog("call")}>
            <PhoneCall className="mr-1 h-4 w-4" /> Log call
          </Button>
          <Button variant="outline" size="sm" onClick={() => openLog("note")}>
            <StickyNote className="mr-1 h-4 w-4" /> Add note
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1 h-4 w-4" /> Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="mr-1 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {lead.customer?.email && (
              <p className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" /> {lead.customer.email}
              </p>
            )}
            {lead.customer?.phone && (
              <p className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" /> {lead.customer.phone}
              </p>
            )}
            {lead.customer?.state && <p>{lead.customer.state}</p>}
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link to={`/contacts/${lead.customer_id}`}>Open full contact</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Move it along</CardTitle>
            <CardDescription>Stage and owner update straight away.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={lead.stage} onValueChange={(stage) => update.mutate({ id: lead.id, stage })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(config?.stages || []).map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={lead.owner_id || NONE}
              onValueChange={(v) => update.mutate({ id: lead.id, owner_id: v === NONE ? null : v })}
            >
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Enquiry details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Detail label="Received" value={formatDateToDDMMYYYY(lead.created_at)} />
            <Detail label="Source" value={lead.source ? lead.source.replace(/_/g, " ") : "—"} />
            <Detail label="People travelling" value={lead.passengers?.toString() || "—"} />
            <Detail
              label="Estimated value"
              value={
                lead.estimated_value
                  ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(
                      Number(lead.estimated_value)
                    )
                  : "—"
              }
            />
            <Detail label="Travelling with" value={lead.companions || "—"} />
            {lead.next_action_date && (
              <p className="flex items-center gap-2 pt-1">
                <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                {formatDateToDDMMYYYY(lead.next_action_date)}
                {lead.next_action_note ? ` — ${lead.next_action_note}` : ""}
              </p>
            )}
            {lead.lost_reason && (
              <Detail label="Lost reason" value={lead.lost_reason.replace(/_/g, " ")} />
            )}
          </CardContent>
        </Card>
      </div>

      {lead.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{lead.notes}</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="history">Stage history</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-4">
          <CrmActivityFeed leadId={lead.id} />
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <RelatedTasksSection entityType="lead" entityId={lead.id} entityLabel={name} />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <ol className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
                <span className="capitalize">
                  {h.from_stage ? `${h.from_stage.replace(/_/g, " ")} → ` : ""}
                  {h.to_stage.replace(/_/g, " ")}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {format(new Date(h.changed_at), "dd/MM/yyyy HH:mm")}
                </span>
              </li>
            ))}
            {history.length === 0 && (
              <p className="text-sm text-muted-foreground">No stage changes recorded yet.</p>
            )}
          </ol>
        </TabsContent>
      </Tabs>

      <LeadDialog open={editOpen} onOpenChange={setEditOpen} lead={lead} />
      <LogActivityDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        customerId={lead.customer_id}
        leadId={lead.id}
        contactName={name}
        defaultType={logType}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this enquiry?</AlertDialogTitle>
            <AlertDialogDescription>
              The contact, their bookings and any tasks stay exactly as they are — only this enquiry
              record and its activity log are removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await remove.mutateAsync(lead.id);
                navigate("/leads");
              }}
            >
              Delete enquiry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="capitalize">{value}</span>
    </p>
  );
}
