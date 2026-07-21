import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "limited_availability", label: "Limited Availability" },
  { value: "sold_out", label: "Sold Out" },
  { value: "cancelled", label: "Cancelled" },
  { value: "available", label: "Available" },
  { value: "closed", label: "Closed" },
];

export const TeamsChannelNotifyCard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [chatId, setChatId] = useState("");
  const [chatName, setChatName] = useState("");
  const [posterUserId, setPosterUserId] = useState<string | null>(null);
  const [posterEmail, setPosterEmail] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<string[]>(["limited_availability", "sold_out"]);
  const [hasTeamsConn, setHasTeamsConn] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("teams_channel_notify_config")
        .select("*")
        .eq("id", true)
        .maybeSingle();
      if (data) {
        setEnabled(!!data.enabled);
        setChatId(data.chat_id || "");
        setChatName(data.chat_name || "");
        setPosterUserId(data.poster_user_id || null);
        setStatuses(data.notify_statuses || ["limited_availability", "sold_out"]);

        if (data.poster_user_id) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", data.poster_user_id)
            .maybeSingle();
          setPosterEmail(prof?.email || null);
        }
      }
      if (user?.id) {
        const { data: conn } = await (supabase as any)
          .from("user_teams_connections")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();
        setHasTeamsConn(!!conn);
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const toggleStatus = (v: string) => {
    setStatuses((prev) => (prev.includes(v) ? prev.filter((s) => s !== v) : [...prev, v]));
  };

  const useMeAsPoster = () => {
    if (!user?.id) return;
    setPosterUserId(user.id);
    setPosterEmail(user.email || null);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("teams_channel_notify_config")
      .update({
        enabled,
        chat_id: chatId.trim() || null,
        chat_name: chatName.trim() || null,
        poster_user_id: posterUserId,
        notify_statuses: statuses,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      })
      .eq("id", true);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Teams chat notification settings updated." });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Teams Chat Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Post a message to a Microsoft Teams group chat automatically when a tour status changes
          (e.g. Limited Availability, Sold Out). Uses the poster's connected Microsoft account.
        </p>

        <div className="flex items-center gap-3">
          <Switch id="teams-notify-enabled" checked={enabled} onCheckedChange={setEnabled} />
          <Label htmlFor="teams-notify-enabled">Enabled</Label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Chat name (for reference)</Label>
            <Input
              value={chatName}
              onChange={(e) => setChatName(e.target.value)}
              placeholder="Website Updates"
            />
          </div>
          <div>
            <Label>Chat ID</Label>
            <Input
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="19:xxxxxxxx@thread.v2"
            />
          </div>
        </div>

        <div className="rounded-md border p-3 space-y-2">
          <Label>Poster (Microsoft account used to post)</Label>
          <div className="text-sm">
            {posterUserId ? (
              <span>
                Current: <strong>{posterEmail || posterUserId}</strong>
              </span>
            ) : (
              <span className="text-muted-foreground">Not set</span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={useMeAsPoster} disabled={!user}>
              Use my account
            </Button>
            {!hasTeamsConn && (
              <span className="text-xs text-amber-600 self-center">
                You haven't connected your Microsoft/Teams account yet — connect it from your
                profile menu first.
              </span>
            )}
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Trigger on these tour statuses</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={statuses.includes(opt.value)}
                  onCheckedChange={() => toggleStatus(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={loading || saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
