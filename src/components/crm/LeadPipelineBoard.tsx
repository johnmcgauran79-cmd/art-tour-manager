import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, Mail, Phone, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { useTours } from "@/hooks/useTours";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";
import { useCrmConfig, useCrmLeads, useUpdateLead, type Lead } from "@/hooks/useCrm";
import { LEAD_PRIORITIES, priorityBadgeClass } from "@/lib/crm/constants";

const ALL = "all";

/** Kanban pipeline over the configurable lead stages, with drag to move. */
export function LeadPipelineBoard() {
  const { data: config } = useCrmConfig();
  const { data: leads = [], isLoading } = useCrmLeads();
  const { data: tours = [] } = useTours();
  const { data: users = [] } = useAssignableUsers();
  const update = useUpdateLead();

  const [search, setSearch] = useState("");
  const [tourId, setTourId] = useState(ALL);
  const [ownerId, setOwnerId] = useState(ALL);
  const [priority, setPriority] = useState(ALL);
  const [flag, setFlag] = useState(ALL);
  const [dragging, setDragging] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return leads.filter((l) => {
      const name = `${l.customer?.first_name || ""} ${l.customer?.last_name || ""} ${l.customer?.email || ""}`;
      if (s && !name.toLowerCase().includes(s)) return false;
      if (tourId !== ALL && l.tour_id !== tourId) return false;
      if (ownerId !== ALL && l.owner_id !== ownerId) return false;
      if (priority !== ALL && l.priority !== priority) return false;
      if (flag === "no_next_action" && l.next_action_date) return false;
      if (flag === "overdue" && !(l.next_action_date && l.next_action_date < today)) return false;
      if (flag === "unowned" && l.owner_id) return false;
      return true;
    });
  }, [leads, search, tourId, ownerId, priority, flag, today]);

  const stages = (config?.stages || []).filter((s) => s.is_active);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search enquiries…"
          className="w-full sm:w-56"
        />
        <Select value={tourId} onValueChange={setTourId}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tour" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All tours</SelectItem>
            {tours.map((t: any) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ownerId} onValueChange={setOwnerId}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Owner" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All owners</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any priority</SelectItem>
            {LEAD_PRIORITIES.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={flag} onValueChange={setFlag}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Needs attention" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Everything</SelectItem>
            <SelectItem value="no_next_action">No next action</SelectItem>
            <SelectItem value="overdue">Overdue follow-up</SelectItem>
            <SelectItem value="unowned">No owner</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary">{filtered.length} shown</Badge>
      </div>

      {isLoading ? (
        <p className="p-6 text-sm text-muted-foreground">Loading pipeline…</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {stages.map((stage) => {
            const items = filtered.filter((l) => l.stage === stage.key);
            return (
              <Card
                key={stage.key}
                className="min-w-[260px] flex-1 bg-muted/30"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragging) update.mutate({ id: dragging, stage: stage.key });
                  setDragging(null);
                }}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.label}
                    </span>
                    <Badge variant="secondary">{items.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {items.map((lead) => (
                    <LeadKanbanCard
                      key={lead.id}
                      lead={lead}
                      needsNextAction={stage.requires_next_action && !lead.next_action_date}
                      overdue={!!lead.next_action_date && lead.next_action_date < today}
                      onDragStart={() => setDragging(lead.id)}
                    />
                  ))}
                  {items.length === 0 && (
                    <p className="py-3 text-center text-xs text-muted-foreground">Empty</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LeadKanbanCard({
  lead,
  needsNextAction,
  overdue,
  onDragStart,
}: {
  lead: Lead;
  needsNextAction: boolean;
  overdue: boolean;
  onDragStart: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="cursor-grab space-y-2 rounded-md border bg-background p-2.5 text-xs active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <Link to={`/leads/${lead.id}`} className="font-medium hover:underline">
          {lead.customer?.first_name} {lead.customer?.last_name}
        </Link>
        <Badge className={priorityBadgeClass(lead.priority)}>{lead.priority}</Badge>
      </div>

      {lead.tour?.name && (
        <Badge variant="outline" className="max-w-full truncate">{lead.tour.name}</Badge>
      )}

      <div className="space-y-1 text-muted-foreground">
        {lead.customer?.email && (
          <div className="flex items-center gap-1.5">
            <Mail className="h-3 w-3" /> <span className="truncate">{lead.customer.email}</span>
          </div>
        )}
        {lead.customer?.phone && (
          <div className="flex items-center gap-1.5">
            <Phone className="h-3 w-3" /> {lead.customer.phone}
          </div>
        )}
        {!!lead.passengers && (
          <div className="flex items-center gap-1.5">
            <Users className="h-3 w-3" /> {lead.passengers} travelling
          </div>
        )}
        {lead.next_action_date && (
          <div className={`flex items-center gap-1.5 ${overdue ? "text-destructive" : ""}`}>
            <CalendarClock className="h-3 w-3" /> {formatDateToDDMMYYYY(lead.next_action_date)}
          </div>
        )}
      </div>

      {needsNextAction && (
        <div className="flex items-center gap-1.5 rounded bg-amber-100 px-2 py-1 text-amber-900">
          <AlertTriangle className="h-3 w-3" /> No next action
        </div>
      )}

      <Button asChild variant="ghost" size="sm" className="h-7 w-full text-xs">
        <Link to={`/leads/${lead.id}`}>Open enquiry</Link>
      </Button>
    </div>
  );
}
