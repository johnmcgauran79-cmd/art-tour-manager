
import { Button } from "@/components/ui/button";
import { UserDropdown } from "@/components/UserDropdown";
import { DateTimeDisplay } from "./DateTimeDisplay";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Menu } from "lucide-react";
interface DashboardHeaderProps {
  isAdmin: boolean;
}

export const DashboardHeader = ({ 
  isAdmin
}: DashboardHeaderProps) => {
  return (
    <div className="bg-brand-navy border-b shadow-sm relative z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          <div className="flex items-center space-x-4">
            <SidebarTrigger className="lg:hidden">
              <Menu className="h-5 w-5 text-white" />
            </SidebarTrigger>
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
