import { useEffect, useMemo, useRef, useState } from "react";
import RGL, { WidthProvider, type LayoutItem } from "react-grid-layout/legacy";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GripVertical, Pencil, RotateCcw, Check, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DASHBOARD_WIDGETS,
  DEFAULT_LAYOUT,
  DEFAULT_HIDDEN,
} from "@/components/dashboard/dashboardWidgets";
import {
  useDashboardLayout,
  useSaveDashboardLayout,
} from "@/hooks/useDashboardLayout";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGrid = WidthProvider(RGL);

// Merge saved layout with defaults so newly-added widgets still show up.
const mergeLayout = (saved: LayoutItem[] | undefined): LayoutItem[] => {
  const map = new Map<string, LayoutItem>();
  DEFAULT_LAYOUT.forEach((d) => map.set(d.i, d));
  (saved ?? []).forEach((s) => {
    if (map.has(s.i)) map.set(s.i, { ...map.get(s.i)!, ...s });
  });
  return Array.from(map.values());
};

export const DashboardGrid = () => {
  const { data: saved, isLoading } = useDashboardLayout();
  const { mutateAsync: save, isPending: saving } = useSaveDashboardLayout();
  const { toast } = useToast();

  const [editMode, setEditMode] = useState(false);
  const [layout, setLayout] = useState<LayoutItem[]>(DEFAULT_LAYOUT);
  const [hidden, setHidden] = useState<string[]>(DEFAULT_HIDDEN);
  const dirty = useRef(false);

  // Hydrate from DB once loaded
  useEffect(() => {
    if (isLoading) return;
    setLayout(mergeLayout(saved?.layout));
    setHidden(saved?.hidden_widgets ?? DEFAULT_HIDDEN);
  }, [isLoading, saved]);

  const visibleWidgets = useMemo(
    () => DASHBOARD_WIDGETS.filter((w) => !hidden.includes(w.id)),
    [hidden]
  );
  const visibleLayout = useMemo(
    () => layout.filter((l) => !hidden.includes(l.i)),
    [layout, hidden]
  );

  const persist = async (nextLayout: LayoutItem[], nextHidden: string[]) => {
    try {
      await save({ layout: nextLayout, hidden_widgets: nextHidden });
    } catch (e: any) {
      toast({
        title: "Couldn't save dashboard",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleLayoutChange = (next: LayoutItem[]) => {
    // Merge back positions for visible items, keep hidden defaults untouched
    const nextMap = new Map(next.map((n) => [n.i, n]));
    const merged = layout.map((l) => nextMap.get(l.i) ?? l);
    setLayout(merged);
    dirty.current = true;
  };

  const handleDoneEditing = async () => {
    if (dirty.current) {
      await persist(layout, hidden);
      dirty.current = false;
    }
    setEditMode(false);
  };

  const toggleWidget = async (id: string, checked: boolean) => {
    const next = checked ? hidden.filter((h) => h !== id) : [...hidden, id];
    setHidden(next);
    await persist(layout, next);
  };

  const resetLayout = async () => {
    setLayout(DEFAULT_LAYOUT);
    setHidden(DEFAULT_HIDDEN);
    await persist(DEFAULT_LAYOUT, DEFAULT_HIDDEN);
    toast({ title: "Dashboard reset", description: "Default layout restored." });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-2" />
              Widgets
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-background">
            <DropdownMenuLabel>Show / hide widgets</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {DASHBOARD_WIDGETS.map((w) => {
              const shown = !hidden.includes(w.id);
              return (
                <label
                  key={w.id}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-muted rounded"
                >
                  <Checkbox
                    checked={shown}
                    onCheckedChange={(v) => toggleWidget(w.id, !!v)}
                  />
                  <span>{w.title}</span>
                </label>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="sm" onClick={resetLayout}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>

        {editMode ? (
          <Button size="sm" onClick={handleDoneEditing} disabled={saving}>
            <Check className="h-4 w-4 mr-2" />
            Done
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setEditMode(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit layout
          </Button>
        )}
      </div>

      <ResponsiveGrid
        className="layout"
        layout={visibleLayout}
        cols={12}
        rowHeight={60}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        isDraggable={editMode}
        isResizable={editMode}
        draggableHandle=".widget-drag-handle"
        onLayoutChange={handleLayoutChange}
      >
        {visibleWidgets.map((w) => {
          const Widget = w.Component;
          return (
            <div
              key={w.id}
              className={`relative overflow-hidden rounded-lg ${
                editMode ? "ring-2 ring-primary/40 ring-offset-2" : ""
              }`}
            >
              {editMode && (
                <div className="widget-drag-handle absolute top-2 right-2 z-20 bg-background/90 border rounded-md p-1 cursor-move shadow-sm">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="h-full w-full overflow-auto">
                <Widget />
              </div>
            </div>
          );
        })}
      </ResponsiveGrid>
    </div>
  );
};