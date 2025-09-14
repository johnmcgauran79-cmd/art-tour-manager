
import { Button } from "@/components/ui/button";
import { UserDropdown } from "@/components/UserDropdown";
import { DateTimeDisplay } from "./DateTimeDisplay";
interface DashboardHeaderProps {
  isAdmin: boolean;
}

export const DashboardHeader = ({ 
  isAdmin
}: DashboardHeaderProps) => {
  return (
    <div className="bg-brand-navy border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-4">
            <img 
              src="/lovable-uploads/901098e1-7efa-42e5-a1db-3d16e421375f.png" 
              alt="Australian Racing Tours Logo" 
              className="h-12 w-auto"
            />
            <div>
              <h1 className="text-2xl font-bold text-brand-yellow">
                Australian Racing Tours
              </h1>
              <p className="text-sm text-white">
                Tour Operations Management System
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <DateTimeDisplay />
            <UserDropdown />
          </div>
        </div>
      </div>
    </div>
  );
};
