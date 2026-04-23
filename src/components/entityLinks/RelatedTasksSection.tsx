import { Link as RouterLink } from "react-router-dom";
import { useTasksLinkedToEntity } from "@/hooks/useTaskEntityLinks";
import { type EntityType } from "@/lib/entityLinks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ListChecks } from "lucide-react";
import { getTaskStatusColor, getTaskPriorityColor, formatStatusText } from "@/lib/statusColors";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface RelatedTasksSectionProps {
  entityType: EntityType;
  entityId: string | undefined;
  /** Optional title override. */
  title?: string;
}

/**
 * Lists tasks that mention this entity in their description or comments
 * (via the `task_entity_links` table populated by Postgres triggers).
 */
export const RelatedTasksSection = ({
  entityType,
  entityId,
  title = "Related Tasks",
}: RelatedTasksSectionProps) => {
  const { data: tasks, isLoading } = useTasksLinkedToEntity(entityType, entityId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ListChecks className="h-4 w-4" />
          {title}
          {tasks && tasks.length > 0 && (
            <Badge variant="secondary" className="ml-1">{tasks.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !tasks || tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No tasks reference this {entityType} yet.
          </p>
        ) : (
          <ul className="divide-y">
            {tasks.map((t: any) => (
              <li key={t.id}>
                <RouterLink
                  to={`/tasks/${t.id}`}
                  className="flex items-center justify-between gap-3 py-2 hover:bg-accent/40 rounded px-2 -mx-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    {t.due_date && (
                      <p className="text-xs text-muted-foreground">
                        Due {format(new Date(t.due_date), "d MMM yyyy")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge className={cn("text-[10px]", getTaskPriorityColor(t.priority))}>
                      {t.priority}
                    </Badge>
                    <Badge className={cn("text-[10px]", getTaskStatusColor(t.status))}>
                      {formatStatusText(t.status)}
                    </Badge>
                  </div>
                </RouterLink>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};