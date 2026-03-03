import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Mail, AlertTriangle, MailX, X, CheckCircle, CheckCheck } from "lucide-react";
import type { EmailIssue } from "@/hooks/useEmailIssues";
import { useAcknowledgeEmailIssue, useAcknowledgeAllEmailIssues } from "@/hooks/useEmailIssueAcknowledgments";

interface EmailIssuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  issues: EmailIssue[];
  issueType: 'bounced' | 'unread';
  title: string;
}

export const EmailIssuesModal = ({
  isOpen,
  onClose,
  issues,
  issueType,
  title,
}: EmailIssuesModalProps) => {
  const acknowledgeIssue = useAcknowledgeEmailIssue();
  const acknowledgeAll = useAcknowledgeAllEmailIssues();

  const handleAcknowledge = (issue: EmailIssue) => {
    acknowledgeIssue.mutate({
      issueType: issue.issue_type,
      emailLogId: issue.id,
      emailAddress: issue.recipient_email,
      lastEventAt: issue.lastEventAt,
    });
  };

  const handleAcknowledgeAll = () => {
    acknowledgeAll.mutate({
      issueType,
      issues: issues.map(issue => ({
        id: issue.id,
        recipient_email: issue.recipient_email,
        issue_type: issue.issue_type,
        lastEventAt: issue.lastEventAt,
      })),
    });
  };

  const getStatusBadge = (issue: EmailIssue) => {
    if (issue.issue_type === 'bounced') {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <MailX className="h-3 w-3" />
          Bounced
        </Badge>
      );
    }
    if (issue.issue_type === 'complained') {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Spam Report
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 flex items-center gap-1">
        <Mail className="h-3 w-3" />
        Unread
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="flex items-center gap-2">
            {issueType === 'bounced' ? (
              <MailX className="h-5 w-5 text-destructive" />
            ) : (
              <Mail className="h-5 w-5 text-amber-600" />
            )}
            {title}
            <Badge variant="secondary" className="ml-2">
              {issues.length}
            </Badge>
          </DialogTitle>
          {issues.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAcknowledgeAll}
                disabled={acknowledgeAll.isPending}
                className="flex items-center gap-1"
              >
                <CheckCheck className="h-4 w-4" />
                Acknowledge All
              </Button>
            </div>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {issues.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No issues found
            </div>
          ) : (
            <div className="space-y-3">
              {issues.map((issue) => (
                <div
                  key={issue.id}
                  className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">
                          {issue.recipient_name || issue.recipient_email}
                        </span>
                        {getStatusBadge(issue)}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {issue.recipient_email}
                      </p>
                      <p className="text-sm font-medium mt-2 truncate">
                        {issue.subject}
                      </p>
                      {issue.tour_name && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Tour: {issue.tour_name}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-right text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(issue.sent_at), 'MMM d, yyyy')}
                        <br />
                        {format(new Date(issue.sent_at), 'h:mm a')}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAcknowledge(issue)}
                        disabled={acknowledgeIssue.isPending}
                        className="text-xs h-7"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Acknowledge
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
