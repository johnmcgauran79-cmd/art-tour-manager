import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  WEBSITE_SECTION_LABELS,
  useIsWebsiteApprover,
  useWebsiteChangeGroups,
  type WebsiteChangeGroup,
} from "@/hooks/useWebsiteChanges";
import { WebsiteChangeReviewDialog } from "./WebsiteChangeReviewDialog";

interface Props {
  /** Limit the queue to a single tour (used on the tour Comms tab). */
  tourId?: string;
}

export function WebsiteChangesPanel({ tourId }: Props) {
  const { data: groups = [], isLoading } = useWebsiteChangeGroups(tourId);
  const isApprover = useIsWebsiteApprover();
  const [selected, setSelected] = useState<WebsiteChangeGroup | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading website changes…
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        No website changes are waiting for approval — the system and the website are in step.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {!isApprover && (
        <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          You can review these changes, but only marketing, managers and admins can approve and publish
          them.
        </p>
      )}

      {groups.map((group) => (
        <div
          key={group.tourId}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
        >
          <div className="min-w-0 space-y-1">
            <p className="font-medium">{group.tourName}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {group.requests.map((r) => (
                <Badge key={r.id} variant="secondary" className="text-[11px]">
                  {WEBSITE_SECTION_LABELS[r.section]} · {r.change_count}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {group.totalChanges} change{group.totalChanges === 1 ? "" : "s"} · last edited{" "}
              {format(parseISO(group.lastChangedAt), "dd/MM/yyyy HH:mm")}
              {group.requests[0]?.changedByName ? ` by ${group.requests[0].changedByName}` : ""}
            </p>
          </div>
          <Button variant="outline" onClick={() => setSelected(group)}>
            <Globe className="mr-2 h-4 w-4" />
            Review changes
          </Button>
        </div>
      ))}

      {selected && (
        <WebsiteChangeReviewDialog
          open={!!selected}
          onOpenChange={(open) => !open && setSelected(null)}
          group={selected}
        />
      )}
    </div>
  );
}