import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, CheckSquare, Send, Mail } from "lucide-react";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { UnifiedEmailApprovals } from "@/components/operations/UnifiedEmailApprovals";
import { UpcomingEmailsPanel } from "@/components/communications/UpcomingEmailsPanel";
import { SentEmailsReport } from "@/components/operations/SentEmailsReport";
import { usePendingApprovalCount } from "@/hooks/useUpcomingEmails";

export default function Communications() {
  const [tab, setTab] = useState("approvals");
  const { data: pendingCount = 0 } = usePendingApprovalCount();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Helmet>
        <title>Communications | ART Admin</title>
        <meta
          name="description"
          content="Approve, schedule and review every client email sent by ART Admin — delivery, open and bounce reporting in one place."
        />
      </Helmet>

      <AppBreadcrumbs items={[{ label: "Communications" }]} />

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Mail className="h-6 w-6" />
          Communications
        </h1>
        <p className="text-sm text-muted-foreground">
          One place for email approvals, upcoming sends and full delivery reporting.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="approvals" className="flex items-center gap-1.5">
            <CheckSquare className="h-3.5 w-3.5" />
            Approvals
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            Emails Due
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex items-center gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Emails Sent
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="space-y-4 mt-6">
          <UnifiedEmailApprovals />
        </TabsContent>

        <TabsContent value="upcoming" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5" />
                Emails Due
              </CardTitle>
              <CardDescription>
                Everything queued, scheduled or forecast across all tours. Defaults
                to the next 14 days — widen the window to see everything due.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UpcomingEmailsPanel />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sent" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Emails Sent
              </CardTitle>
              <CardDescription>
                Delivery, open and bounce reporting for every client-facing email.
                Expand bulk sends to see each recipient and preview the exact email.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SentEmailsReport />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
