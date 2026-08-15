import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock, Send } from "lucide-react";
import { UpcomingEmailsPanel } from "./UpcomingEmailsPanel";
import { SentEmailsReport } from "@/components/operations/SentEmailsReport";

interface Props {
  tourId: string;
  tourName?: string;
}

export const TourCommsReport = ({ tourId }: Props) => (
  <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5" />
          Emails Due
        </CardTitle>
        <CardDescription>
          Every email queued, scheduled or forecast for this tour — including
          automated rules, status-change emails and manually scheduled sends.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <UpcomingEmailsPanel tourId={tourId} hideTourColumn />
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Emails Sent
        </CardTitle>
        <CardDescription>
          Full delivery history for this tour. Expand a bulk send to see each
          recipient, and preview any email exactly as it was sent.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SentEmailsReport tourId={tourId} />
      </CardContent>
    </Card>
  </div>
);
