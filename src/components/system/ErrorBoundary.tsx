import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Global error boundary. Without this, any render-time exception unmounts the
 * whole React tree and leaves staff staring at a blank white screen with no
 * way to recover other than a manual refresh.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught render error:", error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This screen hit an unexpected error. Your data is safe — reloading usually fixes it.
          </p>
          <p className="mt-3 break-words rounded bg-muted px-3 py-2 text-xs font-mono text-muted-foreground">
            {error.message || "Unknown error"}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={this.handleReload}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Reload page
            </Button>
            <Button variant="outline" onClick={this.handleGoHome}>
              Back to dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
