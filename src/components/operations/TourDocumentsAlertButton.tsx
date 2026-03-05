import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileCheck } from "lucide-react";
import { useTourDocumentAlerts } from "@/hooks/useTourDocumentAlerts";

interface TourDocumentsAlertButtonProps {
  tourId: string;
}

export const TourDocumentsAlertButton = ({ tourId }: TourDocumentsAlertButtonProps) => {
  const { missingPassports, missingPickups, missingForms, total, isLoading } = useTourDocumentAlerts(tourId);

  if (isLoading) return null;

  const tooltipLines: string[] = [];
  if (missingPassports > 0) tooltipLines.push(`${missingPassports} passport${missingPassports !== 1 ? 's' : ''} missing`);
  if (missingPickups > 0) tooltipLines.push(`${missingPickups} pickup${missingPickups !== 1 ? 's' : ''} missing`);
  if (missingForms > 0) tooltipLines.push(`${missingForms} form response${missingForms !== 1 ? 's' : ''} missing`);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center justify-center gap-1.5 rounded px-2 py-1 text-xs font-medium ${
            total > 0 
              ? 'bg-amber-100 text-amber-800 border border-amber-300' 
              : 'bg-green-100 text-green-800 border border-green-300'
          }`}>
            <FileCheck className="h-3.5 w-3.5" />
            {total > 0 ? (
              <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs">
                {total}
              </Badge>
            ) : (
              <span>✓</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {total === 0 ? (
            <p>All documents complete</p>
          ) : (
            <div className="space-y-1">
              <p className="font-medium">Outstanding documents:</p>
              {tooltipLines.map((line, i) => (
                <p key={i}>• {line}</p>
              ))}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
