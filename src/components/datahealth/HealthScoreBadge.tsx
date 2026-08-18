import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Traffic-light score badge. Colours come from the semantic status tokens. */
export const HealthScoreBadge = ({ score, className }: { score: number; className?: string }) => {
  const tone =
    score >= 90
      ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900"
      : score >= 70
      ? "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900"
      : "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900";

  return (
    <Badge variant="outline" className={cn("font-semibold tabular-nums", tone, className)}>
      {score}
    </Badge>
  );
};
