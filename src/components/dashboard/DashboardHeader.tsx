
import { Button } from "@/components/ui/button";
import { UserDropdown } from "@/components/users/UserDropdown";
import { DateTimeDisplay } from "./DateTimeDisplay";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useIsMobile } from "@/hooks/use-mobile";
interface DashboardHeaderProps {
  isAdmin: boolean;
}

export const DashboardHeader = ({ 
  isAdmin
}: DashboardHeaderProps) => {
  const isMobile = useIsMobile();
  
  return (
    <div className="relative bg-gradient-brand border-b border-brand-yellow/20 shadow-brand">
      {/* subtle gold accent rail */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-yellow/60 to-transparent" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-5">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-brand-yellow/10 blur-md" />
              <img
                src="/lovable-uploads/901098e1-7efa-42e5-a1db-3d16e421375f.png"
                alt="Australian Racing Tours Logo"
                className="relative h-12 w-auto"
              />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-brand-yellow leading-none">
                Australian Racing Tours
              </h1>
              <p className="mt-1.5 text-xs uppercase tracking-[0.18em] text-white/70">
                Tour Operations Management System
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            {!isMobile && <DateTimeDisplay />}
            <NotificationBell />
            <UserDropdown />
          </div>
        </div>
      </div>
    </div>
  );
};
