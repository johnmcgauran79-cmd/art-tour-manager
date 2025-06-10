
import { ToursTable } from "@/components/ToursTable";

interface ActiveToursProps {
  onViewAll?: () => void;
}

export const ActiveTours = ({ onViewAll }: ActiveToursProps) => {
  return <ToursTable showOnlyActive={true} onViewAll={onViewAll} />;
};
