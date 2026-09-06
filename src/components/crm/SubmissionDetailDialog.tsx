import { format } from "date-fns";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  useMarkSubmissionReviewed,
  useReprocessSubmission,
  type FormSubmission,
} from "@/hooks/useFormSubmissions";
import { useTours } from "@/hooks/useTours";

const Row = ({ label, value }: { label: string; value?: React.ReactNode }) =>
  value === null || value === undefined || value === "" ? null : (
    <div className="grid grid-cols-[10rem_1fr] gap-2 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words">{value}</span>
    </div>
  );

/** Read-only view of exactly what the client submitted, plus what ART did with it. */
export function SubmissionDetailDialog({
  submission,
  open,
  onOpenChange,
}: {
  submission: FormSubmission | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const reprocess = useReprocessSubmission();
  const markReviewed = useMarkSubmissionReviewed();
  const { data: tours = [] } = useTours();

  if (!submission) return null;

  const tourNames = (submission.tour_ids || [])
    .map((id) => tours.find((t: any) => t.id === id)?.name || id)
    .join(", ");
  const answers = Array.isArray(submission.payload?.answers) ? submission.payload.answers : [];
  const passengers = Array.isArray(submission.payload?.passengers)
    ? submission.payload.passengers
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {submission.form_type === "booking" ? "Booking form" : "Register interest"} —{" "}
            {`${submission.first_name || ""} ${submission.last_name || ""}`.trim()}
          </DialogTitle>
          <DialogDescription>
            Submitted {format(new Date(submission.created_at), "dd/MM/yyyy HH:mm")} via{" "}
            {submission.landing_page?.title || "form"}. These answers are kept exactly as sent.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={submission.processing_status === "processed" ? "secondary" : "destructive"}>
            {submission.processing_status === "processed" ? (
              <CheckCircle2 className="mr-1 h-3 w-3" />
            ) : (
              <AlertTriangle className="mr-1 h-3 w-3" />
            )}
            {submission.processing_status}
          </Badge>
          {submission.needs_review && <Badge variant="outline">Needs review</Badge>}
          {submission.match_method && (
            <Badge variant="outline">Matched by {submission.match_method.replace(/_/g, " ")}</Badge>
          )}
          {submission.retry_count > 0 && (
            <Badge variant="outline">Retried {submission.retry_count}×</Badge>
          )}
        </div>

        {(submission.processing_error || submission.review_note) && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            {submission.processing_error && (
              <p>
                <strong>Problem:</strong> {submission.processing_error}
                {submission.processing_step ? ` (at step: ${submission.processing_step})` : ""}
              </p>
            )}
            {submission.review_note && <p className="mt-1">{submission.review_note}</p>}
          </div>
        )}

        <div>
          <h4 className="mb-1 text-sm font-semibold">What they submitted</h4>
          <Row label="Name" value={`${submission.first_name || ""} ${submission.last_name || ""}`} />
          <Row label="Email" value={submission.email} />
          <Row label="Mobile" value={submission.phone} />
          <Row label="State" value={submission.state} />
          <Row label="Country" value={submission.country} />
          <Row label="Tours selected" value={tourNames} />
          <Row label="Travellers" value={submission.travellers} />
          <Row
            label="Travelled before"
            value={
              submission.previous_traveller === null
                ? undefined
                : submission.previous_traveller
                ? "Yes"
                : "No"
            }
          />
          <Row label="Preferred contact" value={submission.preferred_contact} />
          <Row label="Comments" value={submission.message} />
          <Row label="Marketing consent" value={submission.consent_given ? "Given" : "Not given"} />
          <Row label="Consent wording" value={submission.consent_text} />
          {answers.map((a: any, i: number) => (
            <Row key={i} label={a?.label || `Question ${i + 1}`} value={String(a?.value ?? "")} />
          ))}
          {passengers.length > 0 && (
            <Row
              label="Passengers"
              value={passengers
                .map((p: any) => `${p?.first_name || ""} ${p?.last_name || ""}`.trim())
                .filter(Boolean)
                .join(", ")}
            />
          )}
        </div>

        <Separator />

        <div>
          <h4 className="mb-1 text-sm font-semibold">Where it came from</h4>
          <Row label="Source" value={submission.utm_source} />
          <Row label="Medium" value={submission.utm_medium} />
          <Row label="Campaign" value={submission.utm_campaign} />
          <Row label="Content" value={submission.utm_content} />
          <Row label="Term" value={submission.utm_term} />
          <Row label="Referring page" value={submission.referrer} />
          <Row label="Page" value={submission.landing_page_url} />
          <Row label="Reference" value={submission.submission_uid} />
        </div>

        <Separator />

        <div>
          <h4 className="mb-1 text-sm font-semibold">What ART created</h4>
          <Row
            label="Contact"
            value={
              submission.customer_id ? (
                <Link className="underline" to={`/contacts/${submission.customer_id}`}>
                  {`${submission.customer?.first_name || ""} ${
                    submission.customer?.last_name || ""
                  }`.trim() || "Open contact"}
                </Link>
              ) : undefined
            }
          />
          <Row
            label="Enquiry"
            value={
              submission.lead_id ? (
                <Link className="underline" to={`/leads/${submission.lead_id}`}>
                  Open enquiry
                </Link>
              ) : undefined
            }
          />
          <Row
            label="Task"
            value={
              submission.task_id ? (
                <Link className="underline" to={`/tasks/${submission.task_id}`}>
                  Open task
                </Link>
              ) : undefined
            }
          />
          <Row label="Acknowledgement email" value={submission.ack_email_status} />
          <Row
            label="Processed"
            value={
              submission.processed_at
                ? format(new Date(submission.processed_at), "dd/MM/yyyy HH:mm")
                : undefined
            }
          />
        </div>

        <DialogFooter className="gap-2">
          {submission.needs_review && (
            <Button
              variant="outline"
              onClick={() => markReviewed.mutate(submission.id)}
              disabled={markReviewed.isPending}
            >
              Mark as reviewed
            </Button>
          )}
          <Button
            variant="secondary"
            className="gap-1.5"
            onClick={() => reprocess.mutate(submission.id)}
            disabled={reprocess.isPending}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${reprocess.isPending ? "animate-spin" : ""}`} />
            Process again
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
