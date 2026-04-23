import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Mail,
  Check,
  X,
  Calendar,
  Users,
  Loader2,
  Eye,
  RefreshCw,
  ArrowRightLeft,
  Zap,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import { SentEmailsReportModal } from "./SentEmailsReportModal";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  usePendingEmailApprovals,
  useApproveEmails,
  useRejectEmails,
  useSwapEmailApprovalTemplate,
} from "@/hooks/usePendingEmailApprovals";
import {
  usePendingStatusChangeApprovals,
  useApproveStatusChangeEmails,
  useRejectStatusChangeEmails,
  useSwapStatusChangeTemplate,
} from "@/hooks/useStatusChangeEmailQueue";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { ScheduledEmailsSection } from "./ScheduledEmailsSection";
import { PendingEmailPreviewModal } from "./PendingEmailPreviewModal";

type RowSource = "scheduled" | "status_change";

interface UnifiedRow {
  // unique key in the unified list
  uid: string;
  source: RowSource;
  // underlying ID(s) used by the source-specific mutations
  scheduledApprovalId?: string; // for source=scheduled
  statusChangeItemIds?: string[]; // for source=status_change (one row = one batch group of items)
  // display
  title: string;
  subtitle: string;
  countLabel: string;
  dateLabel: string;
  hasOverride: boolean;
  // raw refs for preview/details
  scheduledApproval?: any;
  statusChangeBatch?: any;
}

/**
 * Truly unified Pending Email Approvals.
 * - One list, one Select All, one Approve / Reject / Change Template button set.
 * - Each row is tagged with a colored badge to distinguish Scheduled batches
 *   from Status Change batches.
 * - Approve/Reject route to the correct underlying mutation based on source.
 */
export const UnifiedEmailApprovals = () => {
  const queryClient = useQueryClient();
  const { data: scheduledApprovals, isLoading: loadingScheduled, isRefetching: refetchingScheduled } =
    usePendingEmailApprovals();
  const { data: statusChangeBatches, isLoading: loadingStatus, isRefetching: refetchingStatus } =
    usePendingStatusChangeApprovals();
  const { data: allTemplates } = useEmailTemplates();

  const approveScheduled = useApproveEmails();
  const rejectScheduled = useRejectEmails();
  const swapScheduled = useSwapEmailApprovalTemplate();

  const approveStatus = useApproveStatusChangeEmails();
  const rejectStatus = useRejectStatusChangeEmails();
  const swapStatus = useSwapStatusChangeTemplate();

  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  // Per-item selection for status-change batches.
  // Tracks individual status_change_email_queue item IDs that the user has selected.
  // A status_change row is considered (fully/partially) selected when at least one of its
  // items is in this set OR the row uid itself is in selectedUids (legacy whole-batch select).
  const [selectedStatusItemIds, setSelectedStatusItemIds] = useState<Set<string>>(new Set());
  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const [previewApproval, setPreviewApproval] = useState<any | null>(null);
  const [showSentReport, setShowSentReport] = useState(false);

  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showConfirmRejectDialog, setShowConfirmRejectDialog] = useState(false);
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [swapTemplateId, setSwapTemplateId] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProceedingToConfirm, setIsProceedingToConfirm] = useState(false);

  const isLoading = loadingScheduled || loadingStatus;
  const isRefetching = refetchingScheduled || refetchingStatus;

  const rows: UnifiedRow[] = useMemo(() => {
    const out: UnifiedRow[] = [];

    (scheduledApprovals || []).forEach((a: any) => {
      out.push({
        uid: `sched-${a.id}`,
        source: "scheduled",
        scheduledApprovalId: a.id,
        title: a.tour?.name || "Unknown Tour",
        subtitle: `${a.rule?.rule_name || "Email"} • ${a.rule?.days_before_tour ?? "?"} days before tour`,
        countLabel: `${a.booking_count} booking${a.booking_count !== 1 ? "s" : ""} will receive email`,
        dateLabel: a.tour?.start_date
          ? `Tour: ${format(new Date(a.tour.start_date), "d MMM yyyy")}`
          : "",
        hasOverride: !!a.email_template_id,
        scheduledApproval: a,
      });
    });

    (statusChangeBatches || []).forEach((b: any) => {
      const itemIds = b.items.map((i: any) => i.id);
      const hasOverride = b.items.some((i: any) => i.email_template_id);
      out.push({
        uid: `sc-${b.rule_id}-${b.batch_date}`,
        source: "status_change",
        statusChangeItemIds: itemIds,
        title: b.rule_name,
        subtitle: `Template: ${b.effective_template_name || b.template_name}`,
        countLabel: `${b.items.length} booking${b.items.length !== 1 ? "s" : ""} queued`,
        dateLabel: b.batch_date ? `Queued: ${format(new Date(b.batch_date), "d MMM yyyy")}` : "",
        hasOverride,
        statusChangeBatch: b,
      });
    });

    return out;
  }, [scheduledApprovals, statusChangeBatches]);

  const totalEmailCount =
    (scheduledApprovals?.reduce((s, a: any) => s + (a.booking_count || 0), 0) || 0) +
    (statusChangeBatches?.reduce((s, b) => s + b.items.length, 0) || 0);

  const allUids = rows.map((r) => r.uid);
  // A status_change row counts as "row selected" if its uid is in selectedUids OR all its
  // items are individually selected. For approve/reject we treat any partially-selected
  // status_change row as included (only the picked items will be sent).
  const isRowSelected = (r: UnifiedRow) => {
    if (selectedUids.has(r.uid)) return true;
    if (r.source === "status_change" && r.statusChangeItemIds?.length) {
      return r.statusChangeItemIds.some((id) => selectedStatusItemIds.has(id));
    }
    return false;
  };
  const isRowFullySelected = (r: UnifiedRow) => {
    if (r.source === "scheduled") return selectedUids.has(r.uid);
    const ids = r.statusChangeItemIds || [];
    if (ids.length === 0) return selectedUids.has(r.uid);
    return ids.every((id) => selectedStatusItemIds.has(id)) || selectedUids.has(r.uid);
  };
  const allSelected = allUids.length > 0 && rows.every(isRowFullySelected);
  const selectedRows = rows.filter(isRowSelected);
  // Count individual emails selected (per-booking for status_change, batch booking_count for scheduled)
  const selectedCount = selectedRows.reduce((acc, r) => {
    if (r.source === "scheduled") {
      return acc + (r.scheduledApproval?.booking_count || 1);
    }
    // status_change: count individually-selected items, or all if whole-row selected
    if (selectedUids.has(r.uid)) return acc + (r.statusChangeItemIds?.length || 0);
    return acc + (r.statusChangeItemIds || []).filter((id) => selectedStatusItemIds.has(id)).length;
  }, 0);

  // ---------- selection ----------
  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedUids(new Set(allUids));
      // Also select every status-change item so counts/details stay consistent
      const allItems = new Set<string>();
      rows.forEach((r) => r.statusChangeItemIds?.forEach((id) => allItems.add(id)));
      setSelectedStatusItemIds(allItems);
    } else {
      setSelectedUids(new Set());
      setSelectedStatusItemIds(new Set());
    }
  };
  const toggleOne = (uid: string, checked: boolean) => {
    const next = new Set(selectedUids);
    if (checked) next.add(uid);
    else next.delete(uid);
    setSelectedUids(next);
    // Mirror into per-item set for status_change rows so the row checkbox + item checkboxes stay in sync
    const row = rows.find((r) => r.uid === uid);
    if (row?.source === "status_change" && row.statusChangeItemIds?.length) {
      const items = new Set(selectedStatusItemIds);
      if (checked) row.statusChangeItemIds.forEach((id) => items.add(id));
      else row.statusChangeItemIds.forEach((id) => items.delete(id));
      setSelectedStatusItemIds(items);
    }
  };
  const toggleStatusItem = (itemId: string, rowUid: string, checked: boolean) => {
    const items = new Set(selectedStatusItemIds);
    if (checked) items.add(itemId);
    else items.delete(itemId);
    setSelectedStatusItemIds(items);
    // Keep row uid in selectedUids only when ALL its items are selected, so "Select All" stays consistent
    const row = rows.find((r) => r.uid === rowUid);
    if (row?.statusChangeItemIds?.length) {
      const allChecked = row.statusChangeItemIds.every((id) => items.has(id));
      const next = new Set(selectedUids);
      if (allChecked) next.add(rowUid);
      else next.delete(rowUid);
      setSelectedUids(next);
    }
  };

  // ---------- actions ----------
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["pending-email-approvals"] });
    queryClient.invalidateQueries({ queryKey: ["pending-status-change-approvals"] });
  };

  const splitSelection = () => {
    const scheduledIds = selectedRows
      .filter((r) => r.source === "scheduled")
      .map((r) => r.scheduledApprovalId!)
      .filter(Boolean);
    // For status_change rows, only include the items the user actually selected
    const statusItemIds = selectedRows
      .filter((r) => r.source === "status_change")
      .flatMap((r) => {
        const ids = r.statusChangeItemIds || [];
        if (selectedUids.has(r.uid)) return ids; // whole batch selected
        return ids.filter((id) => selectedStatusItemIds.has(id));
      });
    return { scheduledIds, statusItemIds };
  };

  const isApproving = approveScheduled.isPending || approveStatus.isPending;
  const isRejecting = rejectScheduled.isPending || rejectStatus.isPending;
  const isSwapping = swapScheduled.isPending || swapStatus.isPending;

  const handleApprove = () => {
    if (selectedCount === 0) return;
    setShowApproveDialog(true);
  };

  const confirmApprove = async () => {
    const { scheduledIds, statusItemIds } = splitSelection();
    const tasks: Promise<any>[] = [];
    if (scheduledIds.length) tasks.push(approveScheduled.mutateAsync(scheduledIds));
    if (statusItemIds.length) tasks.push(approveStatus.mutateAsync(statusItemIds));
    try {
      await Promise.all(tasks);
      setSelectedUids(new Set());
    } finally {
      setShowApproveDialog(false);
    }
  };

  const handleReject = () => {
    if (selectedCount === 0) return;
    setShowRejectDialog(true);
  };
  const proceedToConfirmReject = () => {
    setIsProceedingToConfirm(true);
    setShowRejectDialog(false);
    setTimeout(() => {
      setShowConfirmRejectDialog(true);
      setIsProceedingToConfirm(false);
    }, 100);
  };
  const confirmReject = async () => {
    const { scheduledIds, statusItemIds } = splitSelection();
    const tasks: Promise<any>[] = [];
    if (scheduledIds.length)
      tasks.push(rejectScheduled.mutateAsync({ approvalIds: scheduledIds, reason: rejectionReason }));
    if (statusItemIds.length)
      tasks.push(rejectStatus.mutateAsync({ queueIds: statusItemIds, reason: rejectionReason }));
    try {
      await Promise.all(tasks);
      setSelectedUids(new Set());
      setRejectionReason("");
    } finally {
      setShowConfirmRejectDialog(false);
    }
  };
  const cancelReject = () => {
    if (isProceedingToConfirm) return;
    setShowRejectDialog(false);
    setShowConfirmRejectDialog(false);
    setRejectionReason("");
  };

  const handleSwapTemplate = () => {
    if (selectedCount === 0) return;
    setSwapTemplateId("");
    setShowSwapDialog(true);
  };
  const confirmSwapTemplate = async () => {
    if (!swapTemplateId) return;
    const { scheduledIds, statusItemIds } = splitSelection();
    const tasks: Promise<any>[] = [];
    if (scheduledIds.length)
      tasks.push(
        swapScheduled.mutateAsync({ approvalIds: scheduledIds, emailTemplateId: swapTemplateId }),
      );
    if (statusItemIds.length)
      tasks.push(
        swapStatus.mutateAsync({ queueIds: statusItemIds, emailTemplateId: swapTemplateId }),
      );
    try {
      await Promise.all(tasks);
    } finally {
      setShowSwapDialog(false);
      setSwapTemplateId("");
    }
  };

  // ---------- render ----------
  const renderSourceBadge = (source: RowSource) =>
    source === "scheduled" ? (
      <Badge
        variant="outline"
        className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
      >
        <Calendar className="h-3 w-3 mr-1" />
        Scheduled batch
      </Badge>
    ) : (
      <Badge
        variant="outline"
        className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
      >
        <Zap className="h-3 w-3 mr-1" />
        Status change
      </Badge>
    );

  return (
    <>
      <ScheduledEmailsSection />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Pending Emails to Approve
                {totalEmailCount > 0 && <Badge variant="secondary">{totalEmailCount}</Badge>}
              </CardTitle>
              <CardDescription>
                All automated emails awaiting approval — scheduled batches and status-change emails
                in one place. Select any combination and approve or reject together.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setShowSentReport(true)} size="sm" variant="outline">
                <FileText className="h-4 w-4 mr-1" />
                Sent Emails Report
              </Button>
              <Button onClick={handleRefresh} disabled={isRefetching} size="sm" variant="outline">
                <RefreshCw className={`h-4 w-4 mr-1 ${isRefetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                onClick={handleSwapTemplate}
                disabled={selectedCount === 0 || isSwapping}
                size="sm"
                variant="outline"
              >
                <ArrowRightLeft className="h-4 w-4 mr-1" />
                Change Template
              </Button>
              <Button
                onClick={handleApprove}
                disabled={selectedCount === 0 || isApproving}
                size="sm"
                variant="default"
              >
                <Check className="h-4 w-4 mr-1" />
                Approve ({selectedCount})
              </Button>
              <Button
                onClick={handleReject}
                disabled={selectedCount === 0 || isRejecting}
                size="sm"
                variant="destructive"
              >
                <X className="h-4 w-4 mr-1" />
                Reject ({selectedCount})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-4">Loading pending approvals...</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">
              No emails pending approval.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b">
                <Checkbox checked={allSelected} onCheckedChange={(c) => toggleAll(c as boolean)} />
                <span className="text-sm font-medium">Select All ({rows.length})</span>
              </div>

              {rows.map((row) => {
                const isExpanded = expandedUid === row.uid;
                return (
                  <div key={row.uid} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedUids.has(row.uid)}
                        onCheckedChange={(c) => toggleOne(row.uid, c as boolean)}
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="space-y-1">
                            <h4 className="font-medium flex items-center gap-2 flex-wrap">
                              {row.title}
                              {renderSourceBadge(row.source)}
                              {row.hasOverride && (
                                <Badge
                                  variant="outline"
                                  className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                                >
                                  <ArrowRightLeft className="h-3 w-3 mr-1" />
                                  Template Changed
                                </Badge>
                              )}
                            </h4>
                            <p className="text-sm text-muted-foreground">{row.subtitle}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (row.source === "scheduled") {
                                  setPreviewApproval(row.scheduledApproval);
                                } else {
                                  setPreviewApproval({ __statusChange: true, batch: row.statusChangeBatch });
                                }
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Preview
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedUid(isExpanded ? null : row.uid)}
                            >
                              {isExpanded ? (
                                <>
                                  Hide Details <ChevronUp className="h-4 w-4 ml-1" />
                                </>
                              ) : (
                                <>
                                  Show Details <ChevronDown className="h-4 w-4 ml-1" />
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{row.countLabel}</span>
                          </div>
                          {row.dateLabel && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span>{row.dateLabel}</span>
                            </div>
                          )}
                        </div>

                        {isExpanded && row.source === "scheduled" && row.scheduledApproval && (
                          <ScheduledDetails approval={row.scheduledApproval} />
                        )}
                        {isExpanded && row.source === "status_change" && row.statusChangeBatch && (
                          <StatusChangeDetails batch={row.statusChangeBatch} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview modal — handles both scheduled batches and status-change batches */}
      {previewApproval && (() => {
        if (previewApproval.__statusChange) {
          const batch = previewApproval.batch;
          const firstItem = batch?.items?.[0];
          // Override template (per-item swap) takes precedence over rule's default template
          const tpl =
            firstItem?.override_template?.subject_template
              ? firstItem.override_template
              : firstItem?.rule?.email_templates;
          return (
            <PendingEmailPreviewModal
              open={!!previewApproval}
              onOpenChange={(open) => !open && setPreviewApproval(null)}
              tourId={firstItem?.tour_id || ""}
              previewBookingId={firstItem?.booking_id}
              templateSubject={tpl?.subject_template || ""}
              templateContent={tpl?.content_template || ""}
              templateFrom={tpl?.from_email || ""}
              ruleName={batch?.rule_name || ""}
            />
          );
        }
        const tpl =
          previewApproval.override_template || previewApproval.rule?.email_templates;
        return (
          <PendingEmailPreviewModal
            open={!!previewApproval}
            onOpenChange={(open) => !open && setPreviewApproval(null)}
            tourId={previewApproval.tour_id}
            templateSubject={tpl?.subject_template || ""}
            templateContent={tpl?.content_template || ""}
            templateFrom={tpl?.from_email || ""}
            ruleName={previewApproval.rule?.rule_name || ""}
          />
        );
      })()}

      <SentEmailsReportModal
        open={showSentReport}
        onOpenChange={setShowSentReport}
      />

      {/* Swap Template Dialog */}
      <AlertDialog open={showSwapDialog} onOpenChange={setShowSwapDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Email Template</AlertDialogTitle>
            <AlertDialogDescription>
              Select a different template for the {selectedCount} selected item(s). This overrides
              the rule's default template for these queued emails only.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={swapTemplateId} onValueChange={setSwapTemplateId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a template..." />
            </SelectTrigger>
            <SelectContent>
              {allTemplates?.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} ({t.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSwapTemplate} disabled={!swapTemplateId || isSwapping}>
              {isSwapping ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Change Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Confirmation Dialog */}
      <AlertDialog
        open={showApproveDialog}
        onOpenChange={(open) => {
          if (!isApproving) setShowApproveDialog(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isApproving ? "Sending Emails..." : "Approve & Send Emails"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {isApproving ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="font-medium">Processing...</span>
                  </div>
                  <Progress value={undefined} className="h-3 animate-pulse" />
                </div>
              ) : (
                <ApproveSummary selectedRows={selectedRows} />
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApproving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApprove} disabled={isApproving}>
              {isApproving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                "Approve & Send"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject — Step 1: reason */}
      <AlertDialog
        open={showRejectDialog}
        onOpenChange={(open) => {
          if (!open) cancelReject();
          else setShowRejectDialog(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Selected Emails</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to reject {selectedCount} item(s). Optionally provide a reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Rejection reason (optional)"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelReject}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={proceedToConfirmReject}
              className="bg-destructive hover:bg-destructive/90"
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject — Step 2: confirm */}
      <AlertDialog
        open={showConfirmRejectDialog}
        onOpenChange={(open) => {
          if (!open) cancelReject();
          else setShowConfirmRejectDialog(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Rejection</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently reject {selectedCount} item(s). They will not be sent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelReject} disabled={isRejecting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReject}
              disabled={isRejecting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isRejecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// ---------- inline subcomponents ----------

const ScheduledDetails = ({ approval }: { approval: any }) => {
  const tpl = approval.override_template || approval.rule?.email_templates;
  return (
    <div className="mt-3 p-3 bg-muted rounded-md space-y-2">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">Email Template:</p>
        <p className="text-sm">{tpl?.name || "—"}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">Subject:</p>
        <p className="text-sm">{tpl?.subject_template || "—"}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">From:</p>
        <p className="text-sm">{tpl?.from_email || "—"}</p>
      </div>
    </div>
  );
};

const StatusChangeDetails = ({ batch }: { batch: any }) => (
  <div className="mt-3 pl-2 space-y-2">
    <p className="text-xs font-medium text-muted-foreground uppercase">Bookings in this batch:</p>
    <div className="grid gap-2">
      {batch.items.map((item: any) => (
        <div
          key={item.id}
          className="flex items-center justify-between p-2 bg-muted rounded text-sm flex-wrap gap-2"
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {item.booking?.customers?.first_name} {item.booking?.customers?.last_name}
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">{item.booking?.customers?.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {item.previous_status || "new"} → {item.new_status}
            </Badge>
            {item.tour && (
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <Calendar className="h-3 w-3" />
                {item.tour.name}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const ApproveSummary = ({ selectedRows }: { selectedRows: UnifiedRow[] }) => {
  const scheduled = selectedRows.filter((r) => r.source === "scheduled");
  const status = selectedRows.filter((r) => r.source === "status_change");
  const scheduledEmails = scheduled.reduce(
    (s, r) => s + (r.scheduledApproval?.booking_count || 0),
    0,
  );
  const statusEmails = status.reduce((s, r) => s + (r.statusChangeItemIds?.length || 0), 0);
  return (
    <div className="space-y-2 text-sm">
      <p>You're about to approve and send:</p>
      <ul className="list-disc pl-5 space-y-1">
        {scheduled.length > 0 && (
          <li>
            {scheduled.length} scheduled batch{scheduled.length !== 1 ? "es" : ""} (
            {scheduledEmails} email{scheduledEmails !== 1 ? "s" : ""})
          </li>
        )}
        {status.length > 0 && (
          <li>
            {status.length} status-change batch{status.length !== 1 ? "es" : ""} ({statusEmails}{" "}
            email{statusEmails !== 1 ? "s" : ""})
          </li>
        )}
      </ul>
      <p className="text-muted-foreground text-xs">
        Emails are sent immediately to all eligible recipients.
      </p>
    </div>
  );
};
