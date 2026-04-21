import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AssigneeProfile {
  user_id: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

const initialsOf = (p: AssigneeProfile["profiles"]) => {
  if (!p) return "?";
  const first = (p.first_name || "").trim();
  const last = (p.last_name || "").trim();
  if (first || last) return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?";
  if (p.email) return p.email.charAt(0).toUpperCase();
  return "?";
};

const fullNameOf = (p: AssigneeProfile["profiles"]) => {
  if (!p) return "Unknown user";
  const name = `${p.first_name || ""} ${p.last_name || ""}`.trim();
  return name || p.email || "Unknown user";
};

// Deterministic color tint based on user_id so each person gets a stable color
const colorFor = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  const palette = [
    "bg-status-in-progress text-status-in-progress-foreground",
    "bg-status-completed text-status-completed-foreground",
    "bg-status-waiting text-status-waiting-foreground",
    "bg-priority-high text-priority-high-foreground",
    "bg-priority-medium text-priority-medium-foreground",
    "bg-status-deposited text-status-deposited-foreground",
    "bg-status-fully-paid text-status-fully-paid-foreground",
    "bg-status-pending text-status-pending-foreground",
  ];
  return palette[Math.abs(hash) % palette.length];
};

interface Props {
  assignees: AssigneeProfile[];
  max?: number;
}

export const TaskAssigneeAvatars = ({ assignees, max = 3 }: Props) => {
  if (!assignees || assignees.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const visible = assignees.slice(0, max);
  const overflow = assignees.length - visible.length;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex -space-x-2 items-center">
            {visible.map((a) => (
              <Avatar
                key={a.user_id}
                className="h-7 w-7 ring-2 ring-background"
              >
                <AvatarFallback className={`text-[10px] font-semibold ${colorFor(a.user_id)}`}>
                  {initialsOf(a.profiles)}
                </AvatarFallback>
              </Avatar>
            ))}
            {overflow > 0 && (
              <Avatar className="h-7 w-7 ring-2 ring-background">
                <AvatarFallback className="text-[10px] font-semibold bg-muted text-muted-foreground">
                  +{overflow}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            {assignees.map((a) => (
              <div key={a.user_id} className="text-xs">
                {fullNameOf(a.profiles)}
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
