import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * AiContextProvider — the forward-looking contract for page-context injection.
 *
 * Phase 1 does NOT inject page-specific context into the model. This provider
 * exists only to reserve the API so future phases can register the current
 * page's context (e.g. the tour/booking being viewed) and have ART AI pick it
 * up automatically. `context` is surfaced to the workspace and may be sent as
 * an opaque `context` field on new conversations later.
 */
export interface AiPageContext {
  /** A short human label of what the user is looking at, e.g. "Tour: Holy Week 2027". */
  label?: string;
  /** Machine-readable hints (ids, route) — never sensitive data. */
  data?: Record<string, unknown>;
}

interface AiContextValue {
  context: AiPageContext | null;
  setPageContext: (ctx: AiPageContext | null) => void;
}

const AiContext = createContext<AiContextValue | undefined>(undefined);

export const AiContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [context, setContext] = useState<AiPageContext | null>(null);
  const setPageContext = useCallback((ctx: AiPageContext | null) => setContext(ctx), []);
  const value = useMemo(() => ({ context, setPageContext }), [context, setPageContext]);
  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
};

export const useAiContext = () => {
  const ctx = useContext(AiContext);
  if (!ctx) throw new Error("useAiContext must be used within an AiContextProvider");
  return ctx;
};