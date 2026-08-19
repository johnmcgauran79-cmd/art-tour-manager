
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface CSVErrorDisplayProps {
  errors: string[];
}

export const CSVErrorDisplay = ({ errors }: CSVErrorDisplayProps) => {
  if (errors.length === 0) return null;

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        <div className="font-medium mb-2">
          {errors.length === 1 ? 'Import Error:' : `${errors.length} Import Errors:`}
        </div>
        <ul className="list-disc list-inside space-y-1 max-h-40 overflow-y-auto">
          {errors.slice(0, 20).map((error, index) => (
            <li key={index} className="text-sm">{error}</li>
          ))}
          {errors.length > 20 && (
            <li className="text-sm font-medium">...and {errors.length - 20} more errors</li>
          )}
        </ul>
      </AlertDescription>
    </Alert>
  );
};
