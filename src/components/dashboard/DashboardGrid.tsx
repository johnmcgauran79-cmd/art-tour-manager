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
import { useIsMobile } from "@/hooks/use-mobile";
import { UpcomingToursInline } from "@/components/dashboard/UpcomingToursInline";
import {
  DASHBOARD_LAYOUT_VERSION,
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

const stampLayout = (items: LayoutItem[]): LayoutItem[] =>
  items.map((item) => ({
    ...item,
    dashboardVersion: DASHBOARD_LAYOUT_VERSION,
  } as LayoutItem));

const cloneDefaultLayout = (): LayoutItem[] => stampLayout(DEFAULT_LAYOUT);

const hasCurrentLayoutVersion = (items: LayoutItem[] | undefined) =>
  !!items?.length &&
  items.every((item) => (item as LayoutItem & { dashboardVersion?: number }).dashboardVersion === DASHBOARD_LAYOUT_VERSION);

// Merge saved layout with defaults so newly-added widgets still show up.
const mergeLayout = (saved: LayoutItem[] | undefined): LayoutItem[] => {
  if (saved?.length && !hasCurrentLayoutVersion(saved)) {
    return cloneDefaultLayout();
  }

  const map = new Map<string, LayoutItem>();
  DEFAULT_LAYOUT.forEach((d) => map.set(d.i, { ...d }));
  (saved ?? []).forEach((s) => {
    if (map.has(s.i)) {
      map.set(s.i, {
        ...map.get(s.i)!,
        ...s,
        dashboardVersion: DASHBOARD_LAYOUT_VERSION,
      } as LayoutItem);
    }
  });
  return stampLayout(Array.from(map.values()));
};

export const DashboardGrid = () => {
  const { data: saved, isLoading } = useDashboardLayout();
  const { mutateAsync: save, isPending: saving } = useSaveDashboardLayout();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [editMode, setEditMode] = useState(false);
  const [layout, setLayout] = useState<LayoutItem[]>(cloneDefaultLayout());
  const [hidden, setHidden] = useState<string[]>(DEFAULT_HIDDEN);
  const [gridRevision, setGridRevision] = useState(0);
  const dirty = useRef(false);

  // Hydrate from DB once loaded
  useEffect(() => {
    if (isLoading) return;
    const currentSavedLayout = hasCurrentLayoutVersion(saved?.layout);
    setLayout(mergeLayout(saved?.layout));
    setHidden(currentSavedLayout ? saved?.hidden_widgets ?? DEFAULT_HIDDEN : DEFAULT_HIDDEN);
    setGridRevision((revision) => revision + 1);
    dirty.current = false;
  }, [isLoading, saved]);

  const visibleWidgets = useMemo(
    () => DASHBOARD_WIDGETS.filter((w) => !hidden.includes(w.id)),
    [hidden]
  );
  const visibleLayout = useMemo(
    () => layout.filter((l) => !hidden.includes(l.i)),
    [layout, hidden]
  );

  // On mobile, force a single-column stacked layout using the widget order
  // from DASHBOARD_WIDGETS. Ignores saved x/y/w positions but keeps h.
  const mobileLayout = useMemo<LayoutItem[]>(() => {
    let y = 0;
    return visibleWidgets.map((w) => {
      const existing = layout.find((l) => l.i === w.id);
      const h = existing?.h ?? w.default.h ?? 10;
      const item: LayoutItem = {
        i: w.id,
        x: 0,
        y,
        w: 12,
        h,
        minW: 12,
        minH: w.default.minH ?? 3,
      };
      y += h;
      return item;
    });
  }, [visibleWidgets, layout]);

  const persist = async (nextLayout: LayoutItem[], nextHidden: string[]) => {
    try {
      await save({ layout: stampLayout(nextLayout), hidden_widgets: nextHidden });
    } catch (e: any) {
      toast({
        title: "Couldn't save dashboard",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleLayoutChange = (next: LayoutItem[]) => {
    if (!editMode) return;
    // Never persist mobile's forced single-column layout back to the DB.
    if (isMobile) return;

    // Merge back positions for visible items, keep hidden defaults untouched
    const nextMap = new Map(next.map((n) => [n.i, n]));
    const merged = stampLayout(layout.map((l) => nextMap.get(l.i) ?? l));
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
    const defaultLayout = cloneDefaultLayout();
    setLayout(defaultLayout);
    setHidden(DEFAULT_HIDDEN);
    setGridRevision((revision) => revision + 1);
    await persist(defaultLayout, DEFAULT_HIDDEN);
    toast({ title: "Dashboard reset", description: "Default layout restored." });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <UpcomingToursInline />
        <div className="ml-auto flex items-center gap-2">
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

        {!isMobile && (editMode ? (
          <Button size="sm" onClick={handleDoneEditing} disabled={saving}>
            <Check className="h-4 w-4 mr-2" />
            Done
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setEditMode(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit layout
          </Button>
        ))}
        </div>
      </div>

      <ResponsiveGrid
        key={gridRevision}
        className={`dashboard-grid layout ${editMode ? "dashboard-grid--editing" : ""}`}
        layout={isMobile ? mobileLayout : visibleLayout}
        cols={12}
        rowHeight={44}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        compactType="vertical"
        isBounded
        isDraggable={editMode && !isMobile}
        isResizable={editMode && !isMobile}
        draggableHandle=".widget-drag-handle"
        resizeHandles={["se"]}
        onLayoutChange={handleLayoutChange}
      >
        {visibleWidgets.map((w) => {
          const Widget = w.Component;
          return (
            <div
              key={w.id}
              className={`relative overflow-hidden rounded-xl bg-card ${
                editMode ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background" : ""
              }`}
            >
              {editMode && (
                <div className="widget-drag-handle absolute top-2 right-2 z-20 bg-background/90 border rounded-md p-1 cursor-move shadow-sm">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="h-full w-full overflow-hidden">
                <Widget />
              </div>
            </div>
          );
        })}
      </ResponsiveGrid>
    </div>
  );
};