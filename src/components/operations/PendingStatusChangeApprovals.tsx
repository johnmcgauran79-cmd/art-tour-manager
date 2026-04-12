import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Check, X, Calendar, Users, Loader2, ChevronDown, ChevronUp, RefreshCw, ArrowRightLeft } from "lucide-react";
import { 
  usePendingStatusChangeApprovals, 
  useApproveStatusChangeEmails, 
  useRejectStatusChangeEmails,
  useSwapStatusChangeTemplate
} from "@/hooks/useStatusChangeEmailQueue";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export const PendingStatusChangeApprovals = () => {
  const { data: pendingBatches, isLoading, isRefetching } = usePendingStatusChangeApprovals();
  const approveEmails = useApproveStatusChangeEmails();
  const rejectEmails = useRejectStatusChangeEmails();
  const swapTemplate = useSwapStatusChangeTemplate();
  const { data: allTemplates } = useEmailTemplates();
  const queryClient = useQueryClient();
  
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showConfirmRejectDialog, setShowConfirmRejectDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [swapTemplateId, setSwapTemplateId] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [isProceedingToConfirm, setIsProceedingToConfirm] = useState(false);

  const allItemIds = pendingBatches?.flatMap(b => b.items.map(i => i.id)) || [];

  const getBatchItemIds = (batch: NonNullable<typeof pendingBatches>[number]) => {
    return batch.items.map(i => i.id);
  };

  const isBatchFullySelected = (batch: NonNullable<typeof pendingBatches>[number]) => {
    return getBatchItemIds(batch).every(id => selectedItems.has(id));
  };

  const isBatchPartiallySelected = (batch: NonNullable<typeof pendingBatches>[number]) => {
    const ids = getBatchItemIds(batch);
    const selectedCount = ids.filter(id => selectedItems.has(id)).length;
    return selectedCount > 0 && selectedCount < ids.length;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(allItemIds));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectBatch = (batch: NonNullable<typeof pendingBatches>[number], checked: boolean) => {
    const newSelected = new Set(selectedItems);
    const ids = getBatchItemIds(batch);
    if (checked) {
      ids.forEach(id => newSelected.add(id));
    } else {
      ids.forEach(id => newSelected.delete(id));
    }
    setSelectedItems(newSelected);
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(itemId);
    } else {
      newSelected.delete(itemId);
    }
    setSelectedItems(newSelected);
  };

  const toggleExpanded = (batchKey: string) => {
    const newExpanded = new Set(expandedBatches);
    if (newExpanded.has(batchKey)) {
      newExpanded.delete(batchKey);
    } else {
      newExpanded.add(batchKey);
    }
    setExpandedBatches(newExpanded);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['pending-status-change-approvals'] });
  };

  const handleSwapTemplate = () => {
    if (selectedItems.size === 0) return;
    setSwapTemplateId("");
    setShowSwapDialog(true);
  };

  const confirmSwapTemplate = () => {
    if (!swapTemplateId) return;
    const queueIds = Array.from(selectedItems);
    swapTemplate.mutate({ queueIds, emailTemplateId: swapTemplateId }, {
      onSuccess: () => {
        setShowSwapDialog(false);
        setSwapTemplateId("");
      }
    });
  };

  const handleApprove = () => {
    if (selectedItems.size === 0) return;
    setShowApproveDialog(true);
  };

  const confirmApprove = () => {
    const queueIds = Array.from(selectedItems);
    approveEmails.mutate(queueIds, {
      onSuccess: () => {
        setSelectedItems(new Set());
        setShowApproveDialog(false);
      },
      onError: () => {
        setShowApproveDialog(false);
      }
    });
  };

  const handleReject = () => {
    if (selectedItems.size === 0) return;
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

  const confirmReject = () => {
    const queueIds = Array.from(selectedItems);
    rejectEmails.mutate({ queueIds, reason: rejectionReason }, {
      onSuccess: () => {
        setSelectedItems(new Set());
        setRejectionReason("");
        setShowConfirmRejectDialog(false);
      }
    });
  };

  const cancelReject = () => {
    if (isProceedingToConfirm) return;
    setShowRejectDialog(false);
    setShowConfirmRejectDialog(false);
    setRejectionReason("");
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading pending status change approvals...</div>;
  }

  if (!pendingBatches || pendingBatches.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-600" />
                Status Change Email Queue
              </CardTitle>
              <CardDescription>No status change emails pending approval</CardDescription>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={isRefetching}
              size="sm"
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isRefetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>
    );
  }

  const totalBookings = pendingBatches.reduce((sum, b) => sum + b.items.length, 0);
  const allSelected = allItemIds.length > 0 && allItemIds.every(id => selectedItems.has(id));

  return (
    <>
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-600" />
                Status Change Email Queue
                <Badge variant="secondary" className="bg-amber-100 text-amber-700">{totalBookings}</Badge>
              </CardTitle>
              <CardDescription>
                Review and approve emails triggered by booking status changes
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleRefresh}
                disabled={isRefetching}
                size="sm"
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isRefetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={handleSwapTemplate}
                disabled={selectedItems.size === 0 || swapTemplate.isPending}
                size="sm"
                variant="outline"
              >
                <ArrowRightLeft className="h-4 w-4 mr-1" />
                Change Template
              </Button>
              <Button
                onClick={handleApprove}
                disabled={selectedItems.size === 0 || approveEmails.isPending}
                size="sm"
                variant="default"
              >
                <Check className="h-4 w-4 mr-1" />
                Approve ({selectedItems.size})
              </Button>
              <Button
                onClick={handleReject}
                disabled={selectedItems.size === 0 || rejectEmails.isPending}
                size="sm"
                variant="destructive"
              >
                <X className="h-4 w-4 mr-1" />
                Reject ({selectedItems.size})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm font-medium">Select All ({totalBookings})</span>
            </div>

            {pendingBatches.map((batch) => {
              const batchKey = `${batch.rule_id}-${batch.batch_date}`;
              const isExpanded = expandedBatches.has(batchKey);
              const batchFull = isBatchFullySelected(batch);
              const batchPartial = isBatchPartiallySelected(batch);
              const selectedInBatch = getBatchItemIds(batch).filter(id => selectedItems.has(id)).length;
              // Check if any items in batch have a queue-level override
              const hasOverride = batch.items.some(i => i.email_template_id);
              const overrideItem = batch.items.find(i => i.email_template_id);
              
              return (
                <Collapsible key={batchKey} open={isExpanded} onOpenChange={() => toggleExpanded(batchKey)}>
                  <div className="border rounded-lg p-4 space-y-3 bg-background">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={batchFull}
                        ref={(el) => {
                          if (el) {
                            const input = el as unknown as HTMLButtonElement;
                            input.dataset.indeterminate = batchPartial ? "true" : "false";
                          }
                        }}
                        className={batchPartial ? "opacity-70" : ""}
                        onCheckedChange={(checked) => handleSelectBatch(batch, checked as boolean)}
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium flex items-center gap-2">
                              {batch.rule_name}
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                {selectedInBatch > 0 && selectedInBatch < batch.items.length 
                                  ? `${selectedInBatch}/${batch.items.length} selected`
                                  : `${batch.items.length} booking${batch.items.length !== 1 ? 's' : ''}`
                                }
                              </Badge>
                              {hasOverride && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                  <ArrowRightLeft className="h-3 w-3 mr-1" />
                                  Template Changed
                                </Badge>
                              )}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              Template: {batch.effective_template_name || batch.template_name}
                              {hasOverride && batch.template_name !== batch.effective_template_name && (
                                <span className="text-xs ml-1">(was: {batch.template_name})</span>
                              )}
                              {' '}• Queued: {format(new Date(batch.batch_date), 'd MMM yyyy')}
                            </p>
                          </div>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm">
                              {isExpanded ? (
                                <>Hide Details <ChevronUp className="h-4 w-4 ml-1" /></>
                              ) : (
                                <>Show Details <ChevronDown className="h-4 w-4 ml-1" /></>
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>
                    </div>

                    <CollapsibleContent>
                      <div className="mt-3 pl-8 space-y-2">
                        <div className="text-xs font-medium text-muted-foreground uppercase mb-2">
                          Select individual emails:
                        </div>
                        <div className="grid gap-2">
                          {batch.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={selectedItems.has(item.id)}
                                  onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                                />
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {item.booking?.customers?.first_name} {item.booking?.customers?.last_name}
                                </span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-muted-foreground">{item.booking?.customers?.email}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {item.previous_status || 'new'} → {item.new_status}
                                </Badge>
                                {item.tour && (
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {item.tour.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Swap Template Dialog */}
      <AlertDialog open={showSwapDialog} onOpenChange={setShowSwapDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Email Template</AlertDialogTitle>
            <AlertDialogDescription>
              Select a different template for the {selectedItems.size} selected email(s). 
              This will override the rule's default template for these queued emails only.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={swapTemplateId} onValueChange={setSwapTemplateId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a template..." />
            </SelectTrigger>
            <SelectContent>
              {allTemplates?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} ({t.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSwapTemplate} disabled={!swapTemplateId || swapTemplate.isPending}>
              {swapTemplate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Change Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={(open) => {
        if (!approveEmails.isPending) {
          setShowApproveDialog(open);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {approveEmails.isPending ? 'Sending Emails...' : 'Approve & Send Status Change Emails'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              {approveEmails.isPending ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="font-medium">Processing emails...</span>
                  </div>
                  <Progress value={undefined} className="h-3 animate-pulse" />
                  <p className="text-xs text-center text-muted-foreground">
                    Emails are being sent to all passengers with email addresses.
                  </p>
                </div>
              ) : (
                <>
                  <p>
                    Are you sure you want to approve and send {selectedItems.size} email(s)?
                  </p>
                  <p className="text-sm text-muted-foreground">
                    All passengers with email addresses on the selected bookings will receive the email immediately.
                  </p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approveEmails.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmApprove}
              disabled={approveEmails.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {approveEmails.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                'Approve & Send'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog - Step 1: Reason */}
      <AlertDialog open={showRejectDialog} onOpenChange={(open) => {
        if (!open) cancelReject();
        else setShowRejectDialog(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Status Change Emails</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to reject {selectedItems.size} email(s). 
              Optionally provide a reason for the rejection.
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
            <AlertDialogAction onClick={proceedToConfirmReject} className="bg-destructive hover:bg-destructive/90">
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog - Step 2: Final Confirmation */}
      <AlertDialog open={showConfirmRejectDialog} onOpenChange={(open) => {
        if (!open) cancelReject();
        else setShowConfirmRejectDialog(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">⚠️ Permanent Rejection</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="font-medium text-foreground">
                This action is permanent and cannot be undone.
              </p>
              <p>
                The selected {selectedItems.size} email(s) will be permanently rejected and will <strong>never</strong> be sent.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelReject}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmReject}
              className="bg-destructive hover:bg-destructive/90"
            >
              Permanently Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
