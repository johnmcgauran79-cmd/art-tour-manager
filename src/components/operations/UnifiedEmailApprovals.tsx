import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";
import { PendingEmailApprovals } from "./PendingEmailApprovals";
import { PendingStatusChangeApprovals } from "./PendingStatusChangeApprovals";
import { usePendingEmailApprovals } from "@/hooks/usePendingEmailApprovals";
import { usePendingStatusChangeApprovals } from "@/hooks/useStatusChangeEmailQueue";

/**
 * Unified container for all pending email approvals.
 * Combines scheduled (time-based) and status-change (event-based) approvals
 * under a single header with a combined count, while preserving each
 * section's specific row structure and actions.
 */
export const UnifiedEmailApprovals = () => {
  const { data: scheduledApprovals } = usePendingEmailApprovals();
  const { data: statusChangeBatches } = usePendingStatusChangeApprovals();

  const scheduledCount = scheduledApprovals?.length || 0;
  const statusChangeCount = statusChangeBatches?.reduce((sum, b) => sum + b.items.length, 0) || 0;
  const totalCount = scheduledCount + statusChangeCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Pending Email Approvals
          {totalCount > 0 && (
            <Badge variant="secondary">{totalCount}</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Review and approve all automated emails — scheduled batches and status-change triggered emails.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <PendingEmailApprovals />
        <PendingStatusChangeApprovals />
      </CardContent>
    </Card>
  );
};
