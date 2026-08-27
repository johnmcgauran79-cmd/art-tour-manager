import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, AlertCircle, Mail } from "lucide-react";
import { toast } from "sonner";

/**
 * Public marketing preference centre. Reached from the unsubscribe /
 * preferences links in marketing emails: /email-preferences/:token
 * `?unsubscribe=1` unsubscribes immediately (one-click List-Unsubscribe).
 */
export default function EmailPreferences() {
  const { token } = useParams<{ token: string }>();
  const [params] = useSearchParams();
  const oneClick = params.get("unsubscribe") === "1";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [subscribed, setSubscribed] = useState(true);
  const [saved, setSaved] = useState(false);

  const call = async (body: Record<string, unknown>) => {
    const { data, error: fnError } = await supabase.functions.invoke("marketing-preferences", {
      body: { token, ...body },
    });
    if (fnError) throw new Error(fnError.message);
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setError("This link is not valid.");
        setLoading(false);
        return;
      }
      try {
        const data = await call({ action: "get" });
        if (cancelled) return;
        setEmail(data.email || "");
        setSubscribed(!!data.subscribed);

        if (oneClick && data.subscribed) {
          await call({ action: "update", subscribed: false, interests: [] });
          if (cancelled) return;
          setSubscribed(false);
          setSaved(true);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || "This link is no longer valid.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, oneClick]);

  const save = async (next: boolean) => {
    setSaving(true);
    try {
      await call({ action: "update", subscribed: next, interests: [] });
      setSubscribed(next);
      setSaved(true);
      toast.success(next ? "You're subscribed" : "You've been unsubscribed");
    } catch (e: any) {
      toast.error(e.message || "Could not save your preferences");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <CardTitle>Email preferences</CardTitle>
          <CardDescription>
            Australian Racing Tours — manage the marketing emails you receive. Booking and travel
            information for tours you are on will still be sent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your preferences…
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
              <span>{error}</span>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Preferences for <span className="font-medium text-foreground">{email}</span>
              </p>

              <div className="flex items-center justify-between rounded-md border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="subscribed">Marketing emails</Label>
                  <p className="text-xs text-muted-foreground">
                    Tour announcements, offers and news.
                  </p>
                </div>
                <Switch
                  id="subscribed"
                  checked={subscribed}
                  disabled={saving}
                  onCheckedChange={save}
                />
              </div>

              {saved && (
                <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  {subscribed
                    ? "You're subscribed to marketing emails."
                    : "You've been unsubscribed from marketing emails."}
                </div>
              )}

              {!subscribed && (
                <Button variant="outline" className="w-full" disabled={saving} onClick={() => save(true)}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Resubscribe
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
