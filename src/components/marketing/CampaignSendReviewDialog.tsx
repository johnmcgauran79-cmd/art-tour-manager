import { useEffect, useMemo, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { AlertTriangle, CalendarClock, Loader2, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGeneralSettings } from "@/hooks/useGeneralSettings";
import { resolveAudience, type AudienceContact, type AudienceFilters } from "@/lib/edm/audience";

/** Timezones the ART team actually schedules against. */
const TIMEZONES = [
  "Australia/Melbourne",
  "Australia/Sydney",
  "Australia/Brisbane",
  "Australia/Adelaide",
  "Australia/Perth",
  "Australia/Darwin",
  "Australia/Hobart",
  "Pacific/Auckland",
  "Asia/Seoul",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Europe/London",
  "UTC",
];

/** Build a real instant from a wall-clock date/time inside a named timezone. */
export const isoFromZoned = (dateStr: string, timeStr: string, tz: string): Date | null => {
  if (!dateStr || !timeStr) return null;
  const naive = `${dateStr}T${timeStr.length === 5 ? `${timeStr}:00` : timeStr}`;
  const probe = new Date(naive);
  if (Number.isNaN(probe.getTime())) return null;
  let offset = "+00:00";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "longOffset",
    }).formatToParts(probe);
    offset = parts.find((p) => p.type === "timeZoneName")?.value.replace("GMT", "") || "+00:00";
    if (!offset) offset = "+00:00";
  } catch {
    /* fall back to UTC */
  }
  const d = new Date(`${naive}${offset}`);
  return Number.isNaN(d.getTime()) ? null : d;
};

interface SummaryRowProps {
  label: string;
  children: React.ReactNode;
}

const Row = ({ label, children }: SummaryRowProps) => (
  <div className="grid grid-cols-[130px_1fr] gap-3 py-1.5 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="min-w-0 break-words font-medium">{children}</span>
  </div>
);

export interface CampaignSendReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Initial mode when the dialog opens. */
  initialMode?: "now" | "schedule";
  campaignName?: string | null;
  subject?: string | null;
  preheader?: string | null;
  fromName?: string | null;
  fromEmail?: string | null;
  replyTo?: string | null;
  brandName?: string | null;
  /** Human description of the target list. */
  audienceLabel: string;
  /** Filters used to resolve the true recipient list. */
  filters: AudienceFilters;
  isPending?: boolean;
  onSendNow: (recipients: AudienceContact[]) => void;
  onSchedule: (scheduledAtIso: string, recipients: AudienceContact[]) => void;
}

export function CampaignSendReviewDialog({
  open,
  onOpenChange,
  initialMode = "now",
  campaignName,
  subject,
  preheader,
  fromName,
  fromEmail,
  replyTo,
  brandName,
  audienceLabel,
  filters,
  isPending,
  onSendNow,
  onSchedule,
}: CampaignSendReviewDialogProps) {
  const { data: settings } = useGeneralSettings();
  const settingTz = settings?.find((s) => s.setting_key === "display_timezone")?.setting_value;
  const defaultTz =
    (typeof settingTz === "string" && settingTz.trim()) || "Australia/Melbourne";

  const [mode, setMode] = useState<"now" | "schedule">(initialMode);
  const [recipients, setRecipients] = useState<AudienceContact[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [tz, setTz] = useState(defaultTz);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setTz(defaultTz);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMode, defaultTz]);

  useEffect(() => {
    if (!open) {
      setRecipients(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setRecipients(null);
    setLoadError(null);
    resolveAudience(filters)
      .then((rows) => !cancelled && setRecipients(rows))
      .catch((e: any) => !cancelled && setLoadError(e?.message || "Could not resolve audience"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, JSON.stringify(filters)]);

  const scheduledDate = useMemo(() => isoFromZoned(date, time, tz), [date, time, tz]);
  const scheduleValid = !!scheduledDate && scheduledDate.getTime() > Date.now() - 60_000;

  const warnings: string[] = [];
  if (!subject?.trim()) warnings.push("No subject line — add one before sending.");
  if (recipients && recipients.length === 0)
    warnings.push("No consented recipients match this audience.");
  if (!replyTo?.trim())
    warnings.push("No reply-to address — replies to the news. subdomain are not monitored.");

  const blocked = !subject?.trim() || !recipients || recipients.length === 0 || !!loadError;

  const timezoneList = useMemo(
    () => Array.from(new Set([defaultTz, ...TIMEZONES])),
    [defaultTz]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" /> Review before sending
          </DialogTitle>
          <DialogDescription>
            Check the details below, then send now or schedule the campaign.
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y rounded-md border px-3 py-1">
          <Row label="Campaign">{campaignName || "Untitled campaign"}</Row>
          <Row label="Subject">{subject?.trim() || <span className="text-destructive">Missing</span>}</Row>
          {preheader?.trim() ? <Row label="Preheader">{preheader}</Row> : null}
          <Row label="From">
            {fromName?.trim() ? `${fromName} ` : ""}
            {fromEmail ? `<${fromEmail}>` : "—"}
          </Row>
          <Row label="Reply-to">{replyTo?.trim() || "—"}</Row>
          {brandName ? <Row label="Brand / theme">{brandName}</Row> : null}
          <Row label="Audience">{audienceLabel}</Row>
          <Row label="Recipients">
            {loadError ? (
              <span className="text-destructive">{loadError}</span>
            ) : recipients ? (
              <Badge variant="secondary" className="gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {recipients.length} contact{recipients.length === 1 ? "" : "s"}
              </Badge>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Counting…
              </span>
            )}
          </Row>
        </div>

        {warnings.length > 0 && (
          <div className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            {warnings.map((w) => (
              <p key={w} className="flex items-start gap-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
              </p>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "now" ? "default" : "outline"}
              onClick={() => setMode("now")}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" /> Send now
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "schedule" ? "default" : "outline"}
              onClick={() => setMode("schedule")}
              className="gap-1.5"
            >
              <CalendarClock className="h-3.5 w-3.5" /> Schedule
            </Button>
          </div>

          {mode === "schedule" && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Time</Label>
                  <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Timezone</Label>
                <Select value={tz} onValueChange={setTz}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezoneList.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zone.split("/").pop()?.replace("_", " ")} — {zone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {scheduledDate && (
                <p className="text-xs text-muted-foreground">
                  Sends {formatInTimeZone(scheduledDate, tz, "EEE dd/MM/yyyy 'at' HH:mm zzz")} (
                  {formatInTimeZone(scheduledDate, defaultTz, "dd/MM/yyyy HH:mm")} {defaultTz})
                  {!scheduleValid && (
                    <span className="ml-1 text-destructive">— pick a time in the future.</span>
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Back to editing
          </Button>
          {mode === "now" ? (
            <Button
              onClick={() => recipients && onSendNow(recipients)}
              disabled={blocked || isPending}
              className="gap-1.5"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send to {recipients?.length ?? 0} contact
              {recipients?.length === 1 ? "" : "s"}
            </Button>
          ) : (
            <Button
              onClick={() =>
                recipients &&
                scheduledDate &&
                onSchedule(scheduledDate.toISOString(), recipients)
              }
              disabled={blocked || !scheduleValid || isPending}
              className="gap-1.5"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarClock className="h-4 w-4" />
              )}
              Schedule send
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
