import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, CheckSquare, Send, Mail, Globe } from "lucide-react";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { UnifiedEmailApprovals } from "@/components/operations/UnifiedEmailApprovals";
import { UpcomingEmailsPanel } from "@/components/communications/UpcomingEmailsPanel";
import { SentEmailsReport } from "@/components/operations/SentEmailsReport";
import { WebsiteChangesPanel } from "@/components/communications/WebsiteChangesPanel";
import { usePendingApprovalCount } from "@/hooks/useUpcomingEmails";
import { usePendingWebsiteChangeCount } from "@/hooks/useWebsiteChanges";

export default function Communications() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") === "website" ? "website" : "approvals");
  const { data: pendingCount = 0 } = usePendingApprovalCount();
  const { data: websiteChangeCount = 0 } = usePendingWebsiteChangeCount();

  return (
    <div className="space-y-6 p-4 sm:p-6">
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
          <TabsTrigger value="website" className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Website Changes
            {websiteChangeCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {websiteChangeCount}
              </Badge>
            )}
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

        <TabsContent value="website" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Website Changes
              </CardTitle>
              <CardDescription>
                Customer-facing tour content edited in the system and waiting for marketing approval.
                Review the difference against the live website, then approve and publish.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WebsiteChangesPanel />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
