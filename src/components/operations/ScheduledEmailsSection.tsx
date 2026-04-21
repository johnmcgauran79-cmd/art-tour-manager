import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Check, X, Calendar, Users, Mail, RefreshCw, ChevronDown, ChevronRight, Eye } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useScheduledEmails, useApproveScheduledEmails, useRejectScheduledEmails } from "@/hooks/useScheduledEmails";
import { useGeneralSettings } from "@/hooks/useGeneralSettings";
import { useQueryClient } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { PendingEmailPreviewModal } from "./PendingEmailPreviewModal";
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

export const ScheduledEmailsSection = () => {
  const { data: scheduledEmails, isLoading, isRefetching } = useScheduledEmails();
  const approveEmails = useApproveScheduledEmails();
  const rejectEmails = useRejectScheduledEmails();
  const { data: settings } = useGeneralSettings();
  const queryClient = useQueryClient();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [previewGroup, setPreviewGroup] = useState<{
    tourId: string;
    bookingId: string;
    subject: string;
    content: string;
    from: string;
    label: string;
  } | null>(null);

  const timezone = settings?.find(s => s.setting_key === 'display_timezone')?.setting_value || 'Australia/Melbourne';
  const tzString = typeof timezone === 'string' ? timezone : 'Australia/Melbourne';

  const handleSelectAll = (checked: boolean) => {
    if (checked && scheduledEmails) {
      setSelectedIds(scheduledEmails.map(e => e.id));
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
    queryClient.invalidateQueries({ queryKey: ['scheduled-emails'] });
  };

  const confirmApprove = () => {
    approveEmails.mutate(selectedIds, {
      onSuccess: () => {
        setSelectedIds([]);
        setShowApproveDialog(false);
      },
    });
  };

  const confirmReject = () => {
    rejectEmails.mutate({ ids: selectedIds, reason: rejectionReason }, {
      onSuccess: () => {
        setSelectedIds([]);
        setRejectionReason("");
        setShowRejectDialog(false);
      },
    });
  };

  const confirmCancel = () => {
    rejectEmails.mutate({ ids: selectedIds, reason: "Cancelled after approval" }, {
      onSuccess: () => {
        setSelectedIds([]);
        setShowCancelDialog(false);
      },
    });
  };

  const selectedApprovedCount = selectedIds.filter(id => 
    scheduledEmails?.find(e => e.id === id)?.status === 'approved'
  ).length;

  const selectedPendingCount = selectedIds.filter(id => 
    scheduledEmails?.find(e => e.id === id)?.status === 'scheduled'
  ).length;

  const formatScheduledTime = (isoString: string) => {
    try {
      return formatInTimeZone(new Date(isoString), tzString, "EEE d MMM yyyy 'at' h:mm a zzz");
    } catch {
      return new Date(isoString).toLocaleString();
    }
  };

  // Group scheduled emails by tour
  const groupedByTour = (scheduledEmails || []).reduce((acc, email) => {
    const tourId = email.tour_id || 'unknown';
    if (!acc[tourId]) {
      acc[tourId] = {
        tour: email.tour,
        emails: [],
        scheduledAt: email.scheduled_send_at,
      };
    }
    acc[tourId].emails.push(email);
    return acc;
  }, {} as Record<string, { tour: any; emails: typeof scheduledEmails extends (infer T)[] | undefined ? T[] : never[]; scheduledAt: string }>);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading scheduled emails...</div>;
  }

  if (!scheduledEmails || scheduledEmails.length === 0) {
    return null; // Don't show section if no scheduled emails
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Scheduled Emails
                <Badge variant="secondary">{scheduledEmails.length}</Badge>
              </CardTitle>
              <CardDescription>
                Emails scheduled for future delivery. Approve to confirm or reject to cancel.
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
                onClick={() => setShowApproveDialog(true)}
                disabled={selectedPendingCount === 0 || approveEmails.isPending}
                size="sm"
                variant="default"
              >
                <Check className="h-4 w-4 mr-1" />
                Approve ({selectedPendingCount})
              </Button>
              <Button
                onClick={() => setShowCancelDialog(true)}
                disabled={selectedApprovedCount === 0 || rejectEmails.isPending}
                size="sm"
                variant="outline"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel Sending ({selectedApprovedCount})
              </Button>
              <Button
                onClick={() => setShowRejectDialog(true)}
                disabled={selectedPendingCount === 0 || rejectEmails.isPending}
                size="sm"
                variant="destructive"
              >
                <X className="h-4 w-4 mr-1" />
                Reject ({selectedPendingCount})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b">
              <Checkbox
                checked={selectedIds.length === scheduledEmails.length && scheduledEmails.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm font-medium">Select All</span>
            </div>

            {Object.entries(groupedByTour).map(([tourId, group]) => (
              <Collapsible key={tourId}>
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={group.emails.every(e => selectedIds.includes(e.id))}
                        onCheckedChange={(checked) => {
                          const groupIds = group.emails.map(e => e.id);
                          if (checked) {
                            setSelectedIds(prev => [...new Set([...prev, ...groupIds])]);
                          } else {
                            setSelectedIds(prev => prev.filter(id => !groupIds.includes(id)));
                          }
                        }}
                        className="mt-1"
                      />
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 mt-0.5">
                          <ChevronRight className="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-90" />
                        </Button>
                      </CollapsibleTrigger>
                      <div>
                        <h4 className="font-medium">{group.tour?.name || 'Unknown Tour'}</h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            Sends: {formatScheduledTime(group.scheduledAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {group.emails.length} email{group.emails.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const first: any = group.emails[0];
                          const payload = first?.email_payload || {};
                          if (!first?.tour_id || !first?.booking_id) return;
                          setPreviewGroup({
                            tourId: first.tour_id,
                            bookingId: first.booking_id,
                            subject: payload.customSubject || payload.subject || "",
                            content: payload.customContent || payload.content || "",
                            from: payload.fromEmail || payload.from_email || "",
                            label: payload.emailTemplateName || "Scheduled Email",
                          });
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                      {group.emails.some(e => e.status === 'approved') && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Approved
                        </Badge>
                      )}
                      {group.emails.some(e => e.status === 'scheduled') && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          Awaiting Approval
                        </Badge>
                      )}
                    </div>
                  </div>

                  <CollapsibleContent>
                    <div className="space-y-1.5 pl-1 pt-2">
                      {group.emails.map((email) => (
                        <div key={email.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedIds.includes(email.id)}
                            onCheckedChange={(checked) => handleSelectOne(email.id, checked as boolean)}
                          />
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">
                            {(email as any).booking?.customers?.first_name} {(email as any).booking?.customers?.last_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({(email as any).booking?.customers?.email})
                          </span>
                          <Badge variant="outline" className="text-xs ml-auto">
                            {email.status === 'approved' ? '✓ Approved' : 'Pending'}
                          </Badge>
                        </div>
                      ))}
                    </div>

                    {group.emails[0]?.email_payload?.emailTemplateName && (
                      <p className="text-xs text-muted-foreground pt-2 border-t">
                        Template: {group.emails[0].email_payload.emailTemplateName}
                      </p>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Scheduled Emails</AlertDialogTitle>
            <AlertDialogDescription>
              Approve {selectedIds.length} email(s)? They will be sent automatically at their scheduled time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApprove} disabled={approveEmails.isPending}>
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Scheduled Emails</AlertDialogTitle>
            <AlertDialogDescription>
              Reject {selectedIds.length} email(s)? They will not be sent.
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
            <AlertDialogAction
              onClick={confirmReject}
              disabled={rejectEmails.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Sending Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Approved Emails</AlertDialogTitle>
            <AlertDialogDescription>
              Cancel {selectedApprovedCount} approved email(s)? They will be removed from the send queue and will not be sent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Scheduled</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancel}
              disabled={rejectEmails.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              Cancel Sending
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
