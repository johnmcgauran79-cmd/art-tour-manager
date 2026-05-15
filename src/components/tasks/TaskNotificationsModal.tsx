import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, Send, Bell } from "lucide-react";
import {
  TaskNotificationPreferences,
  TaskNotifChannel,
  TaskDigestCadence,
  useSaveTaskNotificationPreferences,
  useSendTestTaskDigest,
  useTaskNotificationPreferences,
} from "@/hooks/useTaskNotificationPreferences";

const PRESET_THRESHOLDS: { label: string; hours: number }[] = [
  { label: "1 week before", hours: 168 },
  { label: "3 days before", hours: 72 },
  { label: "24 hours before", hours: 24 },
  { label: "4 hours before", hours: 4 },
  { label: "1 hour before", hours: 1 },
];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PRIORITIES = ["urgent", "high", "medium", "low"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TaskNotificationsModal = ({ open, onOpenChange }: Props) => {
  const { data: loaded, isLoading } = useTaskNotificationPreferences();
  const save = useSaveTaskNotificationPreferences();
  const sendTest = useSendTestTaskDigest();
  const [prefs, setPrefs] = useState<TaskNotificationPreferences | null>(null);

  useEffect(() => {
    if (loaded && open) setPrefs({ ...loaded });
  }, [loaded, open]);

  if (!prefs) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" /> Task Reminders
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const update = <K extends keyof TaskNotificationPreferences>(
    key: K,
    value: TaskNotificationPreferences[K],
  ) => setPrefs((p) => (p ? { ...p, [key]: value } : p));

  const toggleThreshold = (hours: number) => {
    const set = new Set(prefs.alert_thresholds_hours);
    if (set.has(hours)) set.delete(hours);
    else set.add(hours);
    update("alert_thresholds_hours", Array.from(set).sort((a, b) => b - a));
  };

  const togglePriority = (
    key: "alert_priority_filter" | "digest_priority_filter",
    p: string,
  ) => {
    const list = prefs[key];
    const next = list.includes(p) ? list.filter((x) => x !== p) : [...list, p];
    update(key, next);
  };

  const toggleWeekday = (d: number) => {
    const set = new Set(prefs.digest_weekdays);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    update("digest_weekdays", Array.from(set).sort());
  };

  const handleSave = async () => {
    if (!prefs) return;
    await save.mutateAsync(prefs);
    onOpenChange(false);
  };

  const ChannelSelect = ({
    value,
    onChange,
  }: {
    value: TaskNotifChannel;
    onChange: (v: TaskNotifChannel) => void;
  }) => (
    <Select value={value} onValueChange={(v) => onChange(v as TaskNotifChannel)}>
      <SelectTrigger className="w-full sm:w-[200px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="off">Off</SelectItem>
        <SelectItem value="email">Email only</SelectItem>
        <SelectItem value="teams">Teams only</SelectItem>
        <SelectItem value="both">Email + Teams</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-brand-navy" /> Task Reminders
          </DialogTitle>
          <DialogDescription>
            Configure how and when you receive task alerts and summaries. These settings apply only to you.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="alerts" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="alerts">Due Alerts</TabsTrigger>
            <TabsTrigger value="digest">Summary Digest</TabsTrigger>
            <TabsTrigger value="scope">Scope & Filters</TabsTrigger>
          </TabsList>

          {/* ===== ALERTS ===== */}
          <TabsContent value="alerts" className="space-y-5 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Enable due-soon alerts</Label>
                <p className="text-xs text-muted-foreground">Get notified before tasks reach their due date.</p>
              </div>
              <Switch
                checked={prefs.alerts_enabled}
                onCheckedChange={(v) => update("alerts_enabled", v)}
              />
            </div>

            <div className="space-y-2">
              <Label>Delivery channel</Label>
              <ChannelSelect
                value={prefs.alerts_channel}
                onChange={(v) => update("alerts_channel", v)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Alert me before due date</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_THRESHOLDS.map((t) => {
                  const active = prefs.alert_thresholds_hours.includes(t.hours);
                  return (
                    <Badge
                      key={t.hours}
                      variant={active ? "default" : "outline"}
                      className="cursor-pointer select-none px-3 py-1"
                      onClick={() => toggleThreshold(t.hours)}
                    >
                      {t.label}
                    </Badge>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">Click to toggle each threshold.</p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Remind me when overdue</Label>
                <p className="text-xs text-muted-foreground">Recurring reminder until the task is completed.</p>
              </div>
              <Switch
                checked={prefs.alert_on_overdue}
                onCheckedChange={(v) => update("alert_on_overdue", v)}
              />
            </div>

            {prefs.alert_on_overdue && (
              <div className="space-y-2 pl-2">
                <Label>Repeat reminder every</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    value={prefs.overdue_reminder_interval_hours}
                    onChange={(e) =>
                      update("overdue_reminder_interval_hours", Math.max(1, Number(e.target.value) || 1))
                    }
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">hours</span>
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <Label>Only alert for these priorities</Label>
              <div className="flex flex-wrap gap-3">
                {PRIORITIES.map((p) => (
                  <label key={p} className="flex items-center gap-2 capitalize cursor-pointer">
                    <Checkbox
                      checked={prefs.alert_priority_filter.includes(p)}
                      onCheckedChange={() => togglePriority("alert_priority_filter", p)}
                    />
                    {p}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Leave all unchecked to alert for any priority.
              </p>
            </div>
          </TabsContent>

          {/* ===== DIGEST ===== */}
          <TabsContent value="digest" className="space-y-5 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Enable summary digest</Label>
                <p className="text-xs text-muted-foreground">Periodic email/Teams summary of upcoming tasks.</p>
              </div>
              <Switch
                checked={prefs.digest_enabled}
                onCheckedChange={(v) => update("digest_enabled", v)}
              />
            </div>

            <div className="space-y-2">
              <Label>Delivery channel</Label>
              <ChannelSelect
                value={prefs.digest_channel}
                onChange={(v) => update("digest_channel", v)}
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>Cadence</Label>
              <RadioGroup
                value={prefs.digest_cadence}
                onValueChange={(v) => update("digest_cadence", v as TaskDigestCadence)}
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="daily" id="cad-daily" /> Daily (every day)
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="weekly" id="cad-weekly" /> Weekly (every Monday)
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="custom_weekdays" id="cad-custom" /> Custom weekdays
                </label>
              </RadioGroup>

              {prefs.digest_cadence === "custom_weekdays" && (
                <div className="flex flex-wrap gap-2 pl-2">
                  {WEEKDAY_LABELS.map((label, idx) => {
                    const active = prefs.digest_weekdays.includes(idx);
                    return (
                      <Badge
                        key={label}
                        variant={active ? "default" : "outline"}
                        className="cursor-pointer select-none w-12 justify-center"
                        onClick={() => toggleWeekday(idx)}
                      >
                        {label}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Send time (local)</Label>
                <Input
                  type="time"
                  value={prefs.digest_time_local}
                  onChange={(e) => update("digest_time_local", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Look-ahead window: {prefs.digest_lookahead_days} day{prefs.digest_lookahead_days === 1 ? "" : "s"}</Label>
                <Slider
                  min={1}
                  max={30}
                  step={1}
                  value={[prefs.digest_lookahead_days]}
                  onValueChange={(v) => update("digest_lookahead_days", v[0] || 7)}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Sections to include</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { key: "digest_include_overdue" as const, label: "Overdue tasks" },
                  { key: "digest_include_due_today" as const, label: "Due today" },
                  { key: "digest_include_upcoming" as const, label: "Upcoming (next X days)" },
                  { key: "digest_include_newly_assigned" as const, label: "Newly assigned to me" },
                  { key: "digest_include_watched" as const, label: "Watched (non-assigned)" },
                  { key: "digest_include_subtasks" as const, label: "Include subtasks" },
                ].map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={!!prefs[opt.key]}
                      onCheckedChange={(v) => update(opt.key, !!v)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Only include these priorities</Label>
              <div className="flex flex-wrap gap-3">
                {PRIORITIES.map((p) => (
                  <label key={p} className="flex items-center gap-2 capitalize cursor-pointer">
                    <Checkbox
                      checked={prefs.digest_priority_filter.includes(p)}
                      onCheckedChange={() => togglePriority("digest_priority_filter", p)}
                    />
                    {p}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Leave all unchecked to include any priority.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <Label>Skip if nothing to report</Label>
                <p className="text-xs text-muted-foreground">Don't send empty digests.</p>
              </div>
              <Switch
                checked={prefs.digest_skip_if_empty}
                onCheckedChange={(v) => update("digest_skip_if_empty", v)}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => sendTest.mutate()}
                disabled={sendTest.isPending}
                className="flex items-center gap-2"
              >
                {sendTest.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send test digest now
              </Button>
            </div>
          </TabsContent>

          {/* ===== SCOPE ===== */}
          <TabsContent value="scope" className="space-y-5 pt-4">
            <div className="space-y-2">
              <Label className="text-base">Which tasks should I be notified about?</Label>
              <p className="text-xs text-muted-foreground">Notifications cover any task matching at least one option below.</p>
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={prefs.scope_assigned}
                    onCheckedChange={(v) => update("scope_assigned", !!v)}
                  />
                  Tasks assigned to me
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={prefs.scope_watching}
                    onCheckedChange={(v) => update("scope_watching", !!v)}
                  />
                  Tasks I'm watching
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={prefs.scope_mentioned}
                    onCheckedChange={(v) => update("scope_mentioned", !!v)}
                  />
                  Tasks I've been mentioned in
                </label>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={save.isPending} className="flex items-center gap-2">
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};