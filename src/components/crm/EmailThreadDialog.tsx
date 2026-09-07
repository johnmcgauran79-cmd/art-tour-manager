import { useState } from "react";
import { format } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, ExternalLink, Paperclip, Reply } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCustomerLeads } from "@/hooks/useCrm";
import {
  useDownloadEmailAttachment,
  useEmailThread,
  useSetEmailLead,
  type CrmEmail,
} from "@/hooks/useCrmEmails";
import { ComposeCrmEmailDialog } from "@/components/crm/ComposeCrmEmailDialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  email: CrmEmail | null;
  /** Contact whose record we opened this from, for enquiry linking and replies. */
  customerId?: string | null;
}

const NO_ENQUIRY = "__none__";

/** Full Microsoft conversation, with reply and enquiry linking. */
export function EmailThreadDialog({ open, onOpenChange, email, customerId }: Props) {
  const { data: thread = [], isLoading } = useEmailThread(email?.conversation_id, email?.id);
  const { data: leads = [] } = useCustomerLeads(customerId || undefined);
  const setLead = useSetEmailLead();
  const download = useDownloadEmailAttachment();

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyAll, setReplyAll] = useState(false);
  const [replyTarget, setReplyTarget] = useState<CrmEmail | null>(null);

  const messages = thread.length ? thread : email ? [email] : [];
  const current = email;
  const currentLeadId = (current?.links || []).find((l) => l.lead_id)?.lead_id ?? null;

  const replyRecipients = (m: CrmEmail) =>
    m.direction === "inbound"
      ? [m.from_address].filter(Boolean) as string[]
      : (m.to_recipients || []).map((r) => r.address).filter(Boolean) as string[];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="pr-8">{current?.subject || "Conversation"}</DialogTitle>
            <DialogDescription>
              {messages.length} message{messages.length === 1 ? "" : "s"} · {current?.mailbox?.display_name || current?.mailbox?.address}
            </DialogDescription>
          </DialogHeader>

          {customerId && (
            <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
              <div className="min-w-56">
                <Label className="text-xs">Linked enquiry</Label>
                <Select
                  value={currentLeadId ?? NO_ENQUIRY}
                  onValueChange={(v) =>
                    current &&
                    setLead.mutate({
                      emailId: current.id,
                      leadId: v === NO_ENQUIRY ? null : v,
                      tourId: leads.find((l: any) => l.id === v)?.tour_id ?? null,
                    })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Not linked" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ENQUIRY}>Not linked to an enquiry</SelectItem>
                    {leads.map((l: any) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.tour?.name || "General enquiry"} · {l.stage?.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {current?.web_link && (
                <Button variant="outline" size="sm" asChild>
                  <a href={current.web_link} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open in Outlook
                  </a>
                </Button>
              )}
            </div>
          )}

          <ScrollArea className="max-h-[55vh] pr-3">
            {isLoading && <p className="text-sm text-muted-foreground">Loading conversation…</p>}
            <div className="space-y-3">
              {messages.map((m) => (
                <div key={m.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant={m.direction === "inbound" ? "secondary" : "outline"}>
                      {m.direction === "inbound" ? (
                        <><ArrowDownLeft className="mr-1 h-3 w-3" /> Received</>
                      ) : (
                        <><ArrowUpRight className="mr-1 h-3 w-3" /> Sent</>
                      )}
                    </Badge>
                    <span className="font-medium">{m.from_name || m.from_address}</span>
                    <span className="text-muted-foreground">
                      → {(m.to_recipients || []).map((r) => r.name || r.address).join(", ")}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {format(new Date(m.occurred_at), "dd/MM/yyyy HH:mm")}
                    </span>
                  </div>

                  <div className="mt-2 text-sm">
                    {m.body_html ? (
                      <div
                        className="prose prose-sm max-w-none [&_*]:!font-inherit"
                        dangerouslySetInnerHTML={{ __html: m.body_html }}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap">{m.body_text || m.preview}</p>
                    )}
                  </div>

                  {(m.attachments || []).filter((a) => !a.isInline).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(m.attachments || [])
                        .filter((a) => !a.isInline)
                        .map((a) => (
                          <Button
                            key={a.id}
                            variant="outline"
                            size="sm"
                            disabled={download.isPending}
                            onClick={() => download.mutate({ emailId: m.id, attachmentId: a.id })}
                          >
                            <Paperclip className="mr-1 h-3.5 w-3.5" /> {a.name}
                          </Button>
                        ))}
                    </div>
                  )}

                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setReplyTarget(m);
                        setReplyAll(false);
                        setTimeout(() => setReplyOpen(true), 150);
                      }}
                    >
                      <Reply className="mr-1 h-3.5 w-3.5" /> Reply
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setReplyTarget(m);
                        setReplyAll(true);
                        setTimeout(() => setReplyOpen(true), 150);
                      }}
                    >
                      Reply to all
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <ComposeCrmEmailDialog
        open={replyOpen}
        onOpenChange={(v) => {
          setReplyOpen(v);
          if (!v) setTimeout(() => { document.body.style.pointerEvents = ""; }, 150);
        }}
        replyTo={replyTarget}
        replyAll={replyAll}
        defaultTo={replyTarget ? replyRecipients(replyTarget) : []}
        customerId={customerId ?? null}
        leadId={currentLeadId}
      />
    </>
  );
}
