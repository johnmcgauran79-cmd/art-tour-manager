import { Loader2 } from "lucide-react";

/**
 * Shared fallback for lazily-loaded routes and auth/role gate checks.
 * Replaces the bare "Loading..." text that used to flash on every guard.
 */
export const RouteFallback = ({ label = "Loading…" }: { label?: string }) => (
  <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-live="polite">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  </div>
);
