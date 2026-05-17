import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";
import { HostInfoHubReportModal } from "@/components/hosts/HostInfoHubReportModal";

interface TokenValidation {
  valid: boolean;
  tourId?: string;
  tourName?: string;
  pickupLocationRequired?: boolean;
  hostUserId?: string;
  expiresAt?: string;
  error?: string;
}

const HostReport = () => {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const [validation, setValidation] = useState<TokenValidation | null>(null);
  const [validating, setValidating] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("validate-host-briefing-token", {
          body: { token },
        });
        if (cancelled) return;
        if (error) {
          setValidation({ valid: false, error: error.message });
        } else {
          setValidation(data as TokenValidation);
        }
      } catch (err: any) {
        if (!cancelled) setValidation({ valid: false, error: err.message });
      } finally {
        if (!cancelled) setValidating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (validating || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!validation?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Link unavailable
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {validation?.error || "This host report link is invalid or has expired."}
            </p>
            <p className="text-sm">
              Please log in to the admin website to view the latest host information for your tour.
            </p>
            <Button asChild className="w-full">
              <Link to="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Please log in to view this report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              For your security, the combined host report for{" "}
              <strong>{validation.tourName}</strong> requires you to log in with your host account.
            </p>
            <p className="text-sm text-muted-foreground">
              Use your email address as your username. If you do not remember your password, use the
              "Forgot Password" link on the login page.
            </p>
            <Button asChild className="w-full">
              <Link to={`/login?next=${encodeURIComponent(`/host-report/${token}`)}`}>
                Log in
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Preparing the combined host report for <strong>{validation.tourName}</strong>…
          </p>
          <p className="text-xs text-muted-foreground">The PDF will open in this tab once ready.</p>
        </div>
      </div>
      <HostInfoHubReportModal
        open={true}
        onOpenChange={() => {
          /* keep open — full-page experience */
        }}
        tourId={validation.tourId!}
        tourName={validation.tourName!}
        pickupLocationRequired={validation.pickupLocationRequired ?? false}
        onReady={(url) => {
          // Replace the tab with the native PDF view
          window.location.replace(url);
        }}
      />
    </div>
  );
};

export default HostReport;