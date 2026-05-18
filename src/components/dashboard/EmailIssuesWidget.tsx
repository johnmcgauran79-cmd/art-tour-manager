import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MailX, Mail, ArrowRight } from "lucide-react";
import { useEmailIssues } from "@/hooks/useEmailIssues";
import { EmailIssuesModal } from "./EmailIssuesModal";

export const EmailIssuesWidget = () => {
  const { data, isLoading } = useEmailIssues();
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'bounced' | 'unread';
  }>({ isOpen: false, type: 'bounced' });

  const bouncedCount = data?.bouncedCount || 0;
  const unreadCount = data?.unreadCount || 0;
  const totalCount = bouncedCount + unreadCount;

  const handleRowClick = (type: 'bounced' | 'unread') => {
    setModalState({ isOpen: true, type });
  };

  const closeModal = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MailX className="h-4 w-4 text-primary" />
            Email Delivery Issues
            {totalCount > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {totalCount}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : totalCount === 0 ? (
            <p className="text-sm text-muted-foreground">No email issues</p>
          ) : (
            <div className="space-y-2">
              {bouncedCount > 0 && (
                <button
                  onClick={() => handleRowClick('bounced')}
                  className="w-full flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors text-left"
                >
                  <span className="text-sm flex items-center gap-2">
                    <MailX className="h-4 w-4 text-destructive" />
                    Bounced / Errors
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                      {bouncedCount}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              )}
              {unreadCount > 0 && (
                <button
                  onClick={() => handleRowClick('unread')}
                  className="w-full flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors text-left"
                >
                  <span className="text-sm flex items-center gap-2">
                    <Mail className="h-4 w-4 text-amber-600" />
                    Unread Emails
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                      {unreadCount}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <EmailIssuesModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        issues={
          modalState.type === 'bounced'
            ? data?.bouncedErrors || []
            : data?.unreadEmails || []
        }
        issueType={modalState.type}
        title={
          modalState.type === 'bounced'
            ? 'Bounced & Error Emails'
            : 'Unread Emails'
        }
      />
    </>
  );
};
