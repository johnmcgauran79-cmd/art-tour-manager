import { useTaskActivity, TaskActivityEvent } from "@/hooks/useTaskActivity";
import { Activity, MessageSquare, UserPlus, UserMinus, CheckCircle2, RotateCcw, Paperclip, Calendar, Flag, FileEdit, Edit3, ListChecks } from "lucide-react";
import { format } from "date-fns";

interface TaskActivityFeedProps {
  taskId: string;
}

const EVENT_META: Record<string, { icon: any; label: string }> = {
  status_changed: { icon: Activity, label: "changed status" },
  priority_changed: { icon: Flag, label: "changed priority" },
  due_date_changed: { icon: Calendar, label: "updated due date" },
  title_changed: { icon: FileEdit, label: "renamed task" },
  quick_update_changed: { icon: Edit3, label: "posted a quick update" },
  comment_added: { icon: MessageSquare, label: "commented" },
  assignee_added: { icon: UserPlus, label: "assigned a user" },
  assignee_removed: { icon: UserMinus, label: "removed an assignee" },
  attachment_added: { icon: Paperclip, label: "added an attachment" },
  attachment_removed: { icon: Paperclip, label: "removed an attachment" },
  subtask_added: { icon: ListChecks, label: "added a subtask" },
  subtask_completed: { icon: CheckCircle2, label: "completed a subtask" },
  subtask_reopened: { icon: RotateCcw, label: "reopened a subtask" },
};

const formatActor = (actor: TaskActivityEvent["actor"]) => {
  if (!actor) return "System";
  const name = `${actor.first_name || ""} ${actor.last_name || ""}`.trim();
  return name || actor.email || "Unknown";
};

const renderDelta = (e: TaskActivityEvent) => {
  switch (e.event_type) {
    case "status_changed":
    case "priority_changed":
      return <span className="text-muted-foreground">{e.old_value?.[Object.keys(e.old_value)[0]]} → <strong className="text-foreground">{e.new_value?.[Object.keys(e.new_value)[0]]}</strong></span>;
    case "due_date_changed":
      return <span className="text-muted-foreground">{e.new_value?.due_date ? format(new Date(e.new_value.due_date), 'dd/MM/yyyy') : 'cleared'}</span>;
    case "comment_added":
    case "quick_update_changed":
      return e.message ? <span className="text-foreground italic">"{e.message}"</span> : null;
    case "attachment_added":
    case "attachment_removed":
    case "subtask_added":
    case "subtask_completed":
    case "subtask_reopened":
      return e.message ? <span className="text-foreground">{e.message}</span> : null;
    default:
      return null;
  }
};

export const TaskActivityFeed = ({ taskId }: TaskActivityFeedProps) => {
  const { data: events, isLoading } = useTaskActivity(taskId);

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading activity...</div>;
  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((e) => {
        const meta = EVENT_META[e.event_type] || { icon: Activity, label: e.event_type };
        const Icon = meta.icon;
        return (
          <div key={e.id} className="flex gap-3 items-start border-l-2 border-border pl-3 py-1">
            <div className="mt-0.5 h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-medium">{formatActor(e.actor)}</span>
                <span className="text-muted-foreground">{meta.label}</span>
                <span className="text-xs text-muted-foreground">{format(new Date(e.created_at), 'dd/MM/yyyy HH:mm')}</span>
              </div>
              {renderDelta(e) && <div className="text-sm mt-0.5">{renderDelta(e)}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};
