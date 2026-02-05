import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Zap, Check, X, Calendar, Users, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { 
  usePendingStatusChangeApprovals, 
  useApproveStatusChangeEmails, 
  useRejectStatusChangeEmails 
} from "@/hooks/useStatusChangeEmailQueue";
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
  const { data: pendingBatches, isLoading } = usePendingStatusChangeApprovals();
  const approveEmails = useApproveStatusChangeEmails();
  const rejectEmails = useRejectStatusChangeEmails();
  
  const [selectedBatches, setSelectedBatches] = useState<Set<string>>(new Set());
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showConfirmRejectDialog, setShowConfirmRejectDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [isProceedingToConfirm, setIsProceedingToConfirm] = useState(false);

  const getSelectedQueueIds = () => {
    if (!pendingBatches) return [];
    return pendingBatches
      .filter(batch => selectedBatches.has(`${batch.rule_id}-${batch.batch_date}`))
      .flatMap(batch => batch.items.map(item => item.id));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && pendingBatches) {
      setSelectedBatches(new Set(pendingBatches.map(b => `${b.rule_id}-${b.batch_date}`)));
    } else {
      setSelectedBatches(new Set());
    }
  };

  const handleSelectBatch = (batchKey: string, checked: boolean) => {
    const newSelected = new Set(selectedBatches);
    if (checked) {
      newSelected.add(batchKey);
    } else {
      newSelected.delete(batchKey);
    }
    setSelectedBatches(newSelected);
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

  const handleApprove = () => {
    if (selectedBatches.size === 0) return;
    setShowApproveDialog(true);
  };

  const confirmApprove = () => {
    const queueIds = getSelectedQueueIds();
    approveEmails.mutate(queueIds, {
      onSuccess: () => {
        setSelectedBatches(new Set());
        setShowApproveDialog(false);
      },
      onError: () => {
        setShowApproveDialog(false);
      }
    });
  };

  const handleReject = () => {
    if (selectedBatches.size === 0) return;
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
    const queueIds = getSelectedQueueIds();
    rejectEmails.mutate({ queueIds, reason: rejectionReason }, {
      onSuccess: () => {
        setSelectedBatches(new Set());
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
    return null; // Don't show anything if no pending items
  }

  const totalBookings = pendingBatches.reduce((sum, b) => sum + b.items.length, 0);

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
                onClick={handleApprove}
                disabled={selectedBatches.size === 0 || approveEmails.isPending}
                size="sm"
                variant="default"
              >
                <Check className="h-4 w-4 mr-1" />
                Approve ({selectedBatches.size})
              </Button>
              <Button
                onClick={handleReject}
                disabled={selectedBatches.size === 0 || rejectEmails.isPending}
                size="sm"
                variant="destructive"
              >
                <X className="h-4 w-4 mr-1" />
                Reject ({selectedBatches.size})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b">
              <Checkbox
                checked={selectedBatches.size === pendingBatches.length && pendingBatches.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm font-medium">Select All Batches</span>
            </div>

            {pendingBatches.map((batch) => {
              const batchKey = `${batch.rule_id}-${batch.batch_date}`;
              const isExpanded = expandedBatches.has(batchKey);
              
              return (
                <Collapsible key={batchKey} open={isExpanded} onOpenChange={() => toggleExpanded(batchKey)}>
                  <div className="border rounded-lg p-4 space-y-3 bg-background">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedBatches.has(batchKey)}
                        onCheckedChange={(checked) => handleSelectBatch(batchKey, checked as boolean)}
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium flex items-center gap-2">
                              {batch.rule_name}
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                {batch.items.length} booking{batch.items.length !== 1 ? 's' : ''}
                              </Badge>
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              Template: {batch.template_name} • Queued: {format(new Date(batch.batch_date), 'd MMM yyyy')}
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
                          Bookings in this batch:
                        </div>
                        <div className="grid gap-2">
                          {batch.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
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
                    Are you sure you want to approve and send emails for {selectedBatches.size} batch(es)?
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
              You are about to reject {selectedBatches.size} batch(es). 
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
                The selected {selectedBatches.size} batch(es) will be permanently rejected and emails will <strong>never</strong> be sent.
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
