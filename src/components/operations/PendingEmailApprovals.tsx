import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Mail, Check, X, Calendar, Users, Loader2 } from "lucide-react";
import { usePendingEmailApprovals, useApproveEmails, useRejectEmails } from "@/hooks/usePendingEmailApprovals";
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

export const PendingEmailApprovals = () => {
  const { data: pendingApprovals, isLoading } = usePendingEmailApprovals();
  const approveEmails = useApproveEmails();
  const rejectEmails = useRejectEmails();
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showConfirmRejectDialog, setShowConfirmRejectDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSelectAll = (checked: boolean) => {
    if (checked && pendingApprovals) {
      setSelectedIds(pendingApprovals.map(a => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    }
  };

  const handleApprove = () => {
    if (selectedIds.length === 0) return;
    setShowApproveDialog(true);
  };

  const confirmApprove = () => {
    approveEmails.mutate(selectedIds, {
      onSuccess: () => {
        setSelectedIds([]);
        setShowApproveDialog(false);
      },
      onError: () => {
        setShowApproveDialog(false);
      }
    });
  };

  const handleReject = () => {
    if (selectedIds.length === 0) return;
    setShowRejectDialog(true);
  };

  const proceedToConfirmReject = () => {
    setShowRejectDialog(false);
    setShowConfirmRejectDialog(true);
  };

  const confirmReject = () => {
    rejectEmails.mutate({ approvalIds: selectedIds, reason: rejectionReason });
    setSelectedIds([]);
    setRejectionReason("");
    setShowConfirmRejectDialog(false);
  };

  const cancelReject = () => {
    setShowRejectDialog(false);
    setShowConfirmRejectDialog(false);
    setRejectionReason("");
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading pending approvals...</div>;
  }

  if (!pendingApprovals || pendingApprovals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Pending Email Approvals
          </CardTitle>
          <CardDescription>No email batches pending approval</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Pending Email Approvals
                <Badge variant="secondary">{pendingApprovals.length}</Badge>
              </CardTitle>
              <CardDescription>
                Review and approve automated booking confirmation email batches per tour
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleApprove}
                disabled={selectedIds.length === 0 || approveEmails.isPending}
                size="sm"
                variant="default"
              >
                <Check className="h-4 w-4 mr-1" />
                Approve ({selectedIds.length})
              </Button>
              <Button
                onClick={handleReject}
                disabled={selectedIds.length === 0 || rejectEmails.isPending}
                size="sm"
                variant="destructive"
              >
                <X className="h-4 w-4 mr-1" />
                Reject ({selectedIds.length})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b">
              <Checkbox
                checked={selectedIds.length === pendingApprovals.length}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm font-medium">Select All</span>
            </div>

            {pendingApprovals.map((approval) => (
              <div key={approval.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedIds.includes(approval.id)}
                    onCheckedChange={(checked) => handleSelectOne(approval.id, checked as boolean)}
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{approval.tour?.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {approval.rule?.rule_name} • {approval.rule?.days_before_tour} days before tour
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedId(expandedId === approval.id ? null : approval.id)}
                      >
                        {expandedId === approval.id ? 'Hide Details' : 'Show Details'}
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {approval.booking_count} booking{approval.booking_count !== 1 ? 's' : ''} will receive email
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          Tour: {approval.tour?.start_date ? format(new Date(approval.tour.start_date), 'd MMM yyyy') : 'N/A'}
                        </span>
                      </div>
                    </div>

                    {expandedId === approval.id && (
                      <div className="mt-3 p-3 bg-muted rounded-md space-y-2">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Email Template:</p>
                          <p className="text-sm">{approval.rule?.email_templates?.name}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Subject:</p>
                          <p className="text-sm">{approval.rule?.email_templates?.subject_template}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">From:</p>
                          <p className="text-sm">{approval.rule?.email_templates?.from_email}</p>
                        </div>
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground">
                            Approving this will send emails to all {approval.booking_count} eligible bookings for this tour.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
              {approveEmails.isPending ? 'Sending Emails...' : 'Approve & Send Emails'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              {approveEmails.isPending ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="font-medium">Processing email batches...</span>
                  </div>
                  <Progress value={undefined} className="h-3 animate-pulse" />
                  <p className="text-xs text-center text-muted-foreground">
                    Emails are being sent. This may take a moment to avoid rate limits.
                  </p>
                </div>
              ) : (
                <>
                  <p>
                    Are you sure you want to approve and send {selectedIds.length} email batch(es)?
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Emails will be sent immediately to all eligible bookings in the selected batches.
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
            <AlertDialogTitle>Reject Email Batch</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to reject {selectedIds.length} email batch(es). 
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
                The selected {selectedIds.length} email batch(es) will be permanently rejected and will <strong>never</strong> be sent or reappear for approval.
              </p>
              <p className="text-sm">
                If you need to send these emails in the future, you will need to manually trigger them or create a new automated rule.
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
