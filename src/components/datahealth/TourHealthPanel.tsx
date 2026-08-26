import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown } from "lucide-react";
import { HealthScoreBadge } from "@/components/datahealth/HealthScoreBadge";
import {
  CHECK_LABELS,
  DATA_HEALTH_CHECKS,
  type DataHealthCheckId,
  type TourHealth,
} from "@/hooks/useDataHealth";
import { cn } from "@/lib/utils";

interface TourHealthPanelProps {
  tour: TourHealth;
  /** Show the tour name / departure line in the header. */
  showTourName?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

/**
 * Reusable expandable readiness panel for a single tour — used on Data Health,
 * the Operations tab tour list, and each tour's own Operations tab.
 */
export const TourHealthPanel = ({
  tour,
  showTourName = true,
  defaultOpen = false,
  className,
}: TourHealthPanelProps) => {
  const navigate = useNavigate();

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <div className={cn("rounded-lg border bg-card", className)}>
        <CollapsibleTrigger className="w-full text-left">
          <div className="flex flex-row flex-wrap items-center gap-3 p-4">
            <HealthScoreBadge score={tour.opsScore} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {showTourName ? tour.tourName : "Operational readiness"}
              </p>
              <p className="text-xs text-muted-foreground">
                {tour.opsItems.length === 0
                  ? "No outstanding operational items"
                  : `${tour.opsItems.length} operational item(s) to resolve`}
                {tour.daysOut !== null && ` · ${tour.daysOut} day(s) out`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {tour.dmcManaged && (
                <Badge variant="outline" className="text-[11px]">
                  DMC managed
                </Badge>
              )}
              <Badge variant="outline" className="text-[11px]">
                Guest data {tour.guestScore}
              </Badge>
              {Object.entries(tour.byCheck).map(([key, count]) => (
                <Badge key={key} variant="secondary" className="text-[11px]">
                  {CHECK_LABELS[key as DataHealthCheckId]} {count}
                </Badge>
              ))}
              {tour.items.length === 0 && (
                <Badge variant="outline" className="text-[11px]">
                  All clear
                </Badge>
              )}
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-4 border-t p-4">
            <div className="flex flex-wrap gap-2">
              {DATA_HEALTH_CHECKS.filter((c) => tour.categoryScores[c.id] !== undefined).map((c) => (
                <Badge key={c.id} variant="outline" className="text-[11px] font-normal">
                  <span className="text-muted-foreground">
                    {c.group === "ops" ? "Ops" : "Guest"} · {c.label}
                  </span>
                  <span className="ml-1 font-semibold tabular-nums">{tour.categoryScores[c.id]}</span>
                </Badge>
              ))}
            </div>

            {tour.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing outstanding — this tour is ready to run.</p>
            ) : (
              <div className="space-y-6">
                {(["ops", "guest"] as const).map((group) => {
                  const groupItems = group === "ops" ? tour.opsItems : tour.guestItems;
                  if (groupItems.length === 0) return null;
                  return (
                    <div key={group} className="space-y-2">
                      <h4 className="text-sm font-semibold">
                        {group === "ops"
                          ? `Operational readiness (${groupItems.length})`
                          : `Guest data completeness (${groupItems.length}) — does not affect the tour score`}
                      </h4>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Check</TableHead>
                              <TableHead>Who / what</TableHead>
                              <TableHead>Detail</TableHead>
                              <TableHead className="text-right">Open</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {groupItems.map((item, idx) => (
                              <TableRow key={`${item.checkId}-${idx}`}>
                                <TableCell className="whitespace-nowrap text-xs">
                                  {CHECK_LABELS[item.checkId]}
                                </TableCell>
                                <TableCell className="text-sm">{item.subject}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{item.detail}</TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      navigate(
                                        item.bookingId ? `/bookings/${item.bookingId}` : `/tours/${item.tourId}`
                                      )
                                    }
                                  >
                                    Open
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tour.acknowledged.length > 0 && (
              <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                {tour.acknowledged.length} item(s) acknowledged and excluded from the score.
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

/** Placeholder shown while the health data loads. */
export const TourHealthPanelSkeleton = () => <Skeleton className="h-16 w-full rounded-lg" />;
