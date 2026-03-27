import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScheduledEmailsSection } from "./ScheduledEmailsSection";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Check, X, Calendar, Users, Loader2, Eye, RefreshCw, ArrowRightLeft } from "lucide-react";
import { usePendingEmailApprovals, useApproveEmails, useRejectEmails, useSwapEmailApprovalTemplate } from "@/hooks/usePendingEmailApprovals";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { PendingEmailPreviewModal } from "./PendingEmailPreviewModal";
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

export const PendingEmailApprovals = () => {
  const { data: pendingApprovals, isLoading, isRefetching } = usePendingEmailApprovals();
  const approveEmails = useApproveEmails();
  const rejectEmails = useRejectEmails();
  const swapTemplate = useSwapEmailApprovalTemplate();
  const { data: allTemplates } = useEmailTemplates();
  const queryClient = useQueryClient();
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showConfirmRejectDialog, setShowConfirmRejectDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [swapTemplateId, setSwapTemplateId] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewApproval, setPreviewApproval] = useState<any | null>(null);
  const [isProceedingToConfirm, setIsProceedingToConfirm] = useState(false);

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

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['pending-email-approvals'] });
  };

  const handleSwapTemplate = () => {
    if (selectedIds.length === 0) return;
    setSwapTemplateId("");
    setShowSwapDialog(true);
  };

  const confirmSwapTemplate = () => {
    if (!swapTemplateId) return;
    swapTemplate.mutate({ approvalIds: selectedIds, emailTemplateId: swapTemplateId }, {
      onSuccess: () => {
        setShowSwapDialog(false);
        setSwapTemplateId("");
      }
    });
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
    setIsProceedingToConfirm(true);
    setShowRejectDialog(false);
    setTimeout(() => {
      setShowConfirmRejectDialog(true);
      setIsProceedingToConfirm(false);
    }, 100);
  };

  const confirmReject = () => {
    rejectEmails.mutate({ approvalIds: selectedIds, reason: rejectionReason });
    setSelectedIds([]);
    setRejectionReason("");
    setShowConfirmRejectDialog(false);
  };

  const cancelReject = () => {
    if (isProceedingToConfirm) return;
    setShowRejectDialog(false);
    setShowConfirmRejectDialog(false);
    setRejectionReason("");
  };

  // Helper to get the effective template for an approval item
  const getEffectiveTemplate = (approval: any) => {
    if (!approval) return null;
    if (approval.override_template) {
      return approval.override_template;
    }
    return approval.rule?.email_templates;
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading pending approvals...</div>;
  }

  if (!pendingApprovals || pendingApprovals.length === 0) {
    return (
      <>
        <ScheduledEmailsSection />
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Pending Email Approvals
                </CardTitle>
                <CardDescription>No email batches pending approval</CardDescription>
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
      </>
    );
  }

  return (
    <>
      <ScheduledEmailsSection />
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
                disabled={selectedIds.length === 0 || swapTemplate.isPending}
                size="sm"
                variant="outline"
              >
                <ArrowRightLeft className="h-4 w-4 mr-1" />
                Change Template
              </Button>
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

            {pendingApprovals.map((approval) => {
              const effectiveTemplate = getEffectiveTemplate(approval);
              const hasOverride = !!approval.email_template_id;
              
              return (
                <div key={approval.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedIds.includes(approval.id)}
                      onCheckedChange={(checked) => handleSelectOne(approval.id, checked as boolean)}
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium flex items-center gap-2">
                            {approval.tour?.name}
                            {hasOverride && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                <ArrowRightLeft className="h-3 w-3 mr-1" />
                                Template Changed
                              </Badge>
                            )}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {approval.rule?.rule_name} • {approval.rule?.days_before_tour} days before tour
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreviewApproval(approval)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedId(expandedId === approval.id ? null : approval.id)}
                          >
                            {expandedId === approval.id ? 'Hide Details' : 'Show Details'}
                          </Button>
                        </div>
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
                            <p className="text-sm">
                              {effectiveTemplate?.name}
                              {hasOverride && (
                                <span className="text-xs text-blue-600 ml-2">(overridden)</span>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Subject:</p>
                            <p className="text-sm">{effectiveTemplate?.subject_template}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">From:</p>
                            <p className="text-sm">{effectiveTemplate?.from_email}</p>
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
              Select a different template for the {selectedIds.length} selected batch(es). 
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

      {/* Email Preview Modal */}
      <PendingEmailPreviewModal
        open={!!previewApproval}
        onOpenChange={(open) => !open && setPreviewApproval(null)}
        tourId={previewApproval?.tour?.id || ''}
        templateSubject={getEffectiveTemplate(previewApproval)?.subject_template || ''}
        templateContent={getEffectiveTemplate(previewApproval)?.content_template || ''}
        templateFrom={getEffectiveTemplate(previewApproval)?.from_email || ''}
        ruleName={previewApproval?.rule?.rule_name || ''}
      />
    </>
  );
};
