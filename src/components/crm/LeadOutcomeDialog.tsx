import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useCrmConfig } from "@/hooks/useCrm";
import { useCloseLead } from "@/hooks/useCrmSales";

/**
 * Close an enquiry properly: a lost enquiry always records why, and a nurture
 * enquiry always records when to look at it again so it can never go silent.
 */
export function LeadOutcomeDialog({
  open,
  onOpenChange,
  leadId,
  outcome,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  outcome: "lost" | "nurture";
}) {
  const { data: config } = useCrmConfig();
  const close = useCloseLead();
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [year, setYear] = useState("");

  const submit = async () => {
    await close.mutateAsync(
      outcome === "lost"
        ? { id: leadId, outcome, lost_reason: reason || null, lost_notes: notes || null }
        : {
            id: leadId,
            outcome,
            nurture_review_date: reviewDate || null,
            future_interest_year: year ? Number(year) : null,
            lost_notes: notes || null,
          }
    );
    onOpenChange(false);
    setReason("");
    setNotes("");
    setReviewDate("");
    setYear("");
  };

  const canSubmit = outcome === "lost" ? !!reason : !!reviewDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{outcome === "lost" ? "Close as lost" : "Move to long-term nurture"}</DialogTitle>
          <DialogDescription>
            {outcome === "lost"
              ? "Everything stays on the record — the contact, their history, forms, emails and tasks. We just need to know why it didn't go ahead."
              : "This keeps the person on the radar without them showing up as neglected. Choose when we should look at it again."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {outcome === "lost" ? (
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue placeholder="Pick a reason" /></SelectTrigger>
                <SelectContent>
                  {(config?.lostReasons || []).map((r) => (
                    <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Look at this again on</Label>
                <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Year they're interested in travelling (optional)</Label>
                <Input
                  type="number"
                  min={new Date().getFullYear()}
                  placeholder={String(new Date().getFullYear() + 1)}
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit || close.isPending}>
            {outcome === "lost" ? "Close as lost" : "Move to nurture"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
