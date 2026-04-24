import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";

const TeamsOAuthComplete = () => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const success = params.get("success") === "1";
  const message = params.get("message") || (success ? "Microsoft Teams connected." : "Microsoft Teams connection failed.");
  const displayName = params.get("displayName");

  useEffect(() => {
    try {
      window.opener?.postMessage({ type: "teams-oauth", success }, window.location.origin);
    } catch (_error) {
      // noop
    }

    const timer = window.setTimeout(() => {
      window.close();
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [success]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <section className="w-full max-w-md space-y-5 rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <p className="text-sm font-medium text-muted-foreground">Microsoft Teams</p>
          <h1 className="text-2xl font-semibold tracking-normal">
            {success ? "Connected" : "Connection failed"}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">{message}</p>
          {success && displayName ? (
            <p className="text-sm text-foreground">Signed in as {displayName}</p>
          ) : null}
        </div>

        <div className="flex justify-center">
          <Button type="button" onClick={() => window.close()}>
            Close window
          </Button>
        </div>
      </section>
    </main>
  );
};

export default TeamsOAuthComplete;