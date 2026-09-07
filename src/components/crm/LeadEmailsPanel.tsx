import { useState } from "react";
import { Mail, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmEmailList } from "@/components/crm/CrmEmailList";
import { EmailThreadDialog } from "@/components/crm/EmailThreadDialog";
import { ComposeCrmEmailDialog } from "@/components/crm/ComposeCrmEmailDialog";
import { useLeadEmails, type CrmEmail } from "@/hooks/useCrmEmails";

interface Props {
  leadId: string;
  customerId: string;
  contactEmail?: string | null;
  tourId?: string | null;
  tourName?: string | null;
}

/** Enquiry → Emails: the same email records shown on the contact. */
export function LeadEmailsPanel({ leadId, customerId, contactEmail, tourId, tourName }: Props) {
  const { data: rows = [], isLoading } = useLeadEmails(leadId);
  const [selected, setSelected] = useState<CrmEmail | null>(null);
  const [threadOpen, setThreadOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" /> Emails
          </CardTitle>
          <CardDescription>Outlook correspondence linked to this enquiry.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setComposeOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> New email
        </Button>
      </CardHeader>
      <CardContent>
        <CrmEmailList
          rows={rows}
          isLoading={isLoading}
          onOpen={(e) => {
            setSelected(e);
            setThreadOpen(true);
          }}
          emptyText="No emails linked to this enquiry yet."
        />
      </CardContent>

      <EmailThreadDialog
        open={threadOpen}
        onOpenChange={(v) => {
          setThreadOpen(v);
          if (!v) setTimeout(() => { document.body.style.pointerEvents = ""; }, 150);
        }}
        email={selected}
        customerId={customerId}
      />

      <ComposeCrmEmailDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        defaultTo={contactEmail ? [contactEmail] : []}
        defaultSubject={tourName ? `${tourName} — information` : ""}
        customerId={customerId}
        leadId={leadId}
        tourId={tourId ?? null}
      />
    </Card>
  );
}
