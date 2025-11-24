import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Mail, Check, X, Calendar, User } from "lucide-react";
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
    approveEmails.mutate(selectedIds);
    setSelectedIds([]);
  };

  const handleReject = () => {
    if (selectedIds.length === 0) return;
    setShowRejectDialog(true);
  };

  const confirmReject = () => {
    rejectEmails.mutate({ approvalIds: selectedIds, reason: rejectionReason });
    setSelectedIds([]);
    setRejectionReason("");
    setShowRejectDialog(false);
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
          <CardDescription>No emails pending approval</CardDescription>
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
                Review and approve automated booking confirmation emails
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
                        <h4 className="font-medium">{approval.booking?.tour?.name}</h4>
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
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {approval.booking?.lead_passenger?.first_name}{' '}
                          {approval.booking?.lead_passenger?.last_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{approval.booking?.lead_passenger?.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          Tour: {format(new Date(approval.booking?.tour?.start_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{approval.booking?.passenger_count} passengers</Badge>
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
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Emails</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject {selectedIds.length} email(s)? 
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
            <AlertDialogCancel onClick={() => setRejectionReason("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReject}>
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
