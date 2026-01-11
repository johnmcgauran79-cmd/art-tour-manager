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
      <Card className="border-brand-navy/20 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-brand-navy flex items-center gap-2">
            <MailX className="h-5 w-5" />
            Email Delivery Issues
            {totalCount > 0 && (
              <Badge variant="destructive" className="ml-auto">
                {totalCount}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-4">Loading...</div>
          ) : totalCount === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              No email issues
            </div>
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
