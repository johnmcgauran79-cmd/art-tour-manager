import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StreamlinedTasksTable } from "@/components/tasks/StreamlinedTasksTable";
import { useLeadTasks } from "@/hooks/useMarketing";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";
import type { Task } from "@/hooks/useTasks";

const OPEN_STATUSES = ["completed", "cancelled", "archived", "not_required"];

export function LeadTasksTab() {
  const { data: tasks = [], isLoading } = useLeadTasks();
  const { data: users = [] } = useAssignableUsers();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [assignee, setAssignee] = useState("all");
  const [formType, setFormType] = useState("all");

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (tasks as any[]).filter((t) => {
      if (s && !`${t.title} ${t.description || ""}`.toLowerCase().includes(s)) return false;
      if (statusFilter === "open" && OPEN_STATUSES.includes(t.status)) return false;
      if (statusFilter === "archived" && t.status !== "archived") return false;
      if (statusFilter === "completed" && t.status !== "completed") return false;
      if (assignee !== "all" && !(t.task_assignments || []).some((a: any) => a.user_id === assignee))
        return false;
      if (formType !== "all" && t.lead_form_type !== formType) return false;
      return true;
    });
  }, [tasks, search, statusFilter, assignee, formType]);

  const counts = useMemo(() => {
    const all = tasks as any[];
    return {
      open: all.filter((t) => !OPEN_STATUSES.includes(t.status)).length,
      completed: all.filter((t) => t.status === "completed").length,
      archived: all.filter((t) => t.status === "archived").length,
    };
  }, [tasks]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search lead tasks…"
          className="w-full sm:w-64"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
          </SelectContent>
        </Select>
        <Select value={formType} onValueChange={setFormType}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All form types</SelectItem>
            <SelectItem value="interest">Register interest</SelectItem>
            <SelectItem value="booking">Booking request</SelectItem>
          </SelectContent>
        </Select>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignees</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <Badge variant="secondary">{counts.open} open</Badge>
          <Badge variant="outline">{counts.completed} completed</Badge>
          <Badge variant="outline">{counts.archived} archived</Badge>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Every task created by an interest or booking form. Open a task to log calls and
        discussions, change status, reassign, or archive it if the lead is no good.
      </p>

      <Card>
        <CardContent className="p-0">
          <StreamlinedTasksTable
            tasks={filtered as Task[]}
            loading={isLoading}
            onTaskClick={(task) => navigate(`/tasks/${task.id}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
