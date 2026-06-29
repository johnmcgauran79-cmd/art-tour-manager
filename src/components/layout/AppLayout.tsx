import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { DateTimeDisplay } from "@/components/dashboard/DateTimeDisplay";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { UserDropdown } from "@/components/UserDropdown";
import { ShareButton } from "@/components/ShareButton";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  return (
    <SidebarProvider>
      <div className="h-screen flex flex-col w-full bg-surface overflow-hidden">
        {/* Full-width header across the whole page */}
        <header className="shrink-0 z-50 flex items-center justify-between gap-2 border-b border-border/70 bg-gradient-brand px-3 sm:px-6 py-3 shadow-brand">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <SidebarTrigger className="text-brand-yellow hover:bg-white/10" />
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex items-center gap-2 min-w-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow"
              aria-label="Go to home"
            >
              <img
                src="/lovable-uploads/901098e1-7efa-42e5-a1db-3d16e421375f.png"
                alt="Australian Racing Tours"
                className="h-8 w-auto shrink-0"
              />
              <div className="min-w-0 text-left">
                <h1 className="font-display text-base sm:text-lg font-bold tracking-tight text-brand-yellow leading-none truncate">
                  Tour Operations
                </h1>
                <p className="hidden sm:block mt-1 text-[10px] uppercase tracking-[0.18em] text-white/70">
                  Management System
                </p>
              </div>
            </button>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            {!isMobile && <DateTimeDisplay />}
            <NotificationBell />
            <UserDropdown />
          </div>
        </header>

        {/* Below header: menu on the left, main panel on the right */}
        <div className="flex flex-1 w-full min-h-0 overflow-hidden">
          <AppSidebar />
          <main className="flex-1 min-w-0 overflow-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="max-w-7xl w-full mx-auto">{children}</div>
          </main>
        </div>
      </div>

      {/* Global floating Share button — copies the current URL so teammates can
          deep-link to whatever page or settings sub-tab is currently open. */}
      <div className="fixed bottom-4 right-4 z-50">
        <ShareButton
          title="Current page"
          context="Link"
          variant="default"
          className="shadow-lg"
        />
      </div>
    </SidebarProvider>
  );
};
