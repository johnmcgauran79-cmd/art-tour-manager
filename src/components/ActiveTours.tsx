
import { Button } from "@/components/ui/button";
import { ToursTable } from "@/components/ToursTable";

interface ActiveToursProps {
  onViewAll?: () => void;
}

export const ActiveTours = ({ onViewAll }: ActiveToursProps) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Active Tours</h2>
        {onViewAll && (
          <Button 
            variant="outline" 
            onClick={onViewAll}
            className="text-sm"
          >
            View All
          </Button>
        )}
      </div>
      <ToursTable showOnlyActive={true} />
    </div>
  );
};
