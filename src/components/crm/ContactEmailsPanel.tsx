import { useState } from "react";
import { Mail, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CrmEmailList } from "@/components/crm/CrmEmailList";
import { EmailThreadDialog } from "@/components/crm/EmailThreadDialog";
import { ComposeCrmEmailDialog } from "@/components/crm/ComposeCrmEmailDialog";
import { useCustomerLeads } from "@/hooks/useCrm";
import {
  PAGE_SIZE,
  useContactEmails,
  useMailboxes,
  type CrmEmail,
  type EmailFilters,
} from "@/hooks/useCrmEmails";

interface Props {
  customerId: string;
  contactEmail?: string | null;
  contactName?: string | null;
}

const ALL = "__all__";

/** Contact → Emails: individual Outlook correspondence for this person. */
export function ContactEmailsPanel({ customerId, contactEmail, contactName }: Props) {
  const [filters, setFilters] = useState<EmailFilters>({ direction: "all" });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<CrmEmail | null>(null);
  const [threadOpen, setThreadOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useContactEmails(customerId, filters, page);
  const { data: mailboxes = [] } = useMailboxes();
  const { data: leads = [] } = useCustomerLeads(customerId);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const set = (patch: Partial<EmailFilters>) => {
    setPage(0);
    setFilters((f) => ({ ...f, ...patch }));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" /> Personal emails (Outlook)
          </CardTitle>
          <CardDescription>
            Individual correspondence between our team and this person, from the connected Microsoft mailboxes.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setComposeOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> New email
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label className="text-xs">Direction</Label>
            <Select value={filters.direction || "all"} onValueChange={(v: any) => set({ direction: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="inbound">Incoming</SelectItem>
                <SelectItem value="outbound">Outgoing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Enquiry</Label>
            <Select
              value={filters.leadId || ALL}
              onValueChange={(v) => set({ leadId: v === ALL ? undefined : v })}
            >
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All enquiries</SelectItem>
                {leads.map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>{l.tour?.name || "General enquiry"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Mailbox</Label>
            <Select
              value={filters.mailboxId || ALL}
              onValueChange={(v) => set({ mailboxId: v === ALL ? undefined : v })}
            >
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All mailboxes</SelectItem>
                {mailboxes.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.display_name || m.address}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">From date</Label>
            <Input type="date" value={filters.from || ""} onChange={(e) => set({ from: e.target.value || undefined })} />
          </div>
          <div>
            <Label className="text-xs">Search</Label>
            <Input
              placeholder="Subject or text"
              value={filters.search || ""}
              onChange={(e) => set({ search: e.target.value || undefined })}
            />
          </div>
        </div>

        <CrmEmailList
          rows={rows}
          isLoading={isLoading}
          onOpen={(e) => {
            setSelected(e);
            setThreadOpen(true);
          }}
        />

        {pages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Page {page + 1} of {pages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
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
        defaultSubject=""
        customerId={customerId}
      />
    </Card>
  );
}
