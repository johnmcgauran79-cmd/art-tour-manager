import { useCallback, useEffect, useState } from "react";

/**
 * Named filter presets for list views, persisted per user/browser.
 * The filter payload is opaque to the hook — each table decides its own shape.
 */
export interface SavedView<T = Record<string, unknown>> {
  id: string;
  name: string;
  filters: T;
}

const storageKey = (tableKey: string) => `art:saved-views:${tableKey}`;

function read<T>(tableKey: string): SavedView<T>[] {
  try {
    const raw = localStorage.getItem(storageKey(tableKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useSavedViews<T extends Record<string, unknown>>(tableKey: string) {
  const [views, setViews] = useState<SavedView<T>[]>([]);

  useEffect(() => {
    setViews(read<T>(tableKey));
  }, [tableKey]);

  const persist = useCallback(
    (next: SavedView<T>[]) => {
      setViews(next);
      try {
        localStorage.setItem(storageKey(tableKey), JSON.stringify(next));
      } catch {
        // Storage full or blocked — presets are a convenience only.
      }
    },
    [tableKey]
  );

  const saveView = useCallback(
    (name: string, filters: T) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const existing = views.find((v) => v.name.toLowerCase() === trimmed.toLowerCase());
      const next = existing
        ? views.map((v) => (v.id === existing.id ? { ...v, filters } : v))
        : [...views, { id: crypto.randomUUID(), name: trimmed, filters }];
      persist(next);
    },
    [views, persist]
  );

  const deleteView = useCallback(
    (id: string) => persist(views.filter((v) => v.id !== id)),
    [views, persist]
  );

  return { views, saveView, deleteView };
}