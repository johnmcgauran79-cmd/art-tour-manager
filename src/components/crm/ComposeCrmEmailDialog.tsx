import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useMailboxes, useSendCrmEmail, type CrmEmail } from "@/hooks/useCrmEmails";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Reply mode when supplied. */
  replyTo?: CrmEmail | null;
  replyAll?: boolean;
  defaultTo?: string[];
  defaultSubject?: string;
  customerId?: string | null;
  leadId?: string | null;
  tourId?: string | null;
  bookingId?: string | null;
}

/** Sends an individual email through Microsoft 365, using existing templates. */
export function ComposeCrmEmailDialog({
  open,
  onOpenChange,
  replyTo,
  replyAll,
  defaultTo = [],
  defaultSubject = "",
  customerId,
  leadId,
  tourId,
  bookingId,
}: Props) {
  const { data: mailboxes = [] } = useMailboxes();
  const { data: templates = [] } = useEmailTemplates();
  const send = useSendCrmEmail();

  const usable = useMemo(() => mailboxes.filter((m) => m.is_enabled), [mailboxes]);
  const [mailboxId, setMailboxId] = useState("");
  const [to, setTo] = useState(defaultTo.join(", "));
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [html, setHtml] = useState("");

  useEffect(() => {
    if (!open) return;
    setTo(defaultTo.join(", "));
    setSubject(replyTo ? `RE: ${(replyTo.subject || "").replace(/^(re:\s*)+/i, "")}` : defaultSubject);
    setCc("");
    setHtml("");
    setMailboxId(replyTo?.mailbox_id || usable[0]?.id || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isReply = !!replyTo;
  const canSend = !!mailboxId && !!html.trim() && (isReply || to.trim().length > 0);

  const submit = async () => {
    await send.mutateAsync({
      mailboxId,
      mode: isReply ? (replyAll ? "replyAll" : "reply") : "new",
      replyToEmailId: replyTo?.id,
      to: to.split(",").map((v) => v.trim()).filter(Boolean),
      cc: cc.split(",").map((v) => v.trim()).filter(Boolean),
      subject,
      html,
      customerId,
      leadId,
      tourId,
      bookingId,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isReply ? "Reply" : "New email"}</DialogTitle>
          <DialogDescription>
            Sent through Microsoft 365 — it will appear in Outlook Sent Items and on this record.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Send from</Label>
              <Select value={mailboxId} onValueChange={setMailboxId}>
                <SelectTrigger><SelectValue placeholder="Choose a mailbox" /></SelectTrigger>
                <SelectContent>
                  {usable.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.display_name ? `${m.display_name} — ${m.address}` : m.address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Use a template</Label>
              <Select
                onValueChange={(id) => {
                  const t: any = templates.find((x: any) => x.id === id);
                  if (!t) return;
                  if (!isReply && t.subject_template) setSubject(t.subject_template);
                  setHtml(t.content_template || "");
                }}
              >
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {(templates as any[]).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isReply && (
            <>
              <div>
                <Label>To</Label>
                <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com" />
              </div>
              <div>
                <Label>CC</Label>
                <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Optional" />
              </div>
            </>
          )}

          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={isReply} />
          </div>

          <div>
            <Label>Message</Label>
            <RichTextEditor value={html} onChange={setHtml} placeholder="Write your message…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!canSend || send.isPending}>
            {send.isPending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
