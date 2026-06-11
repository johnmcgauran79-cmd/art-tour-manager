import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-surface">
        <AppSidebar />
        <SidebarInset className="flex flex-col min-w-0">
          <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-border/70 bg-gradient-brand px-3 sm:px-6 py-3 shadow-brand">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger className="text-brand-yellow hover:bg-white/10" />
              <div className="min-w-0">
                <h1 className="font-display text-base sm:text-lg font-bold tracking-tight text-brand-yellow leading-none truncate">
                  Tour Operations
                </h1>
                <p className="hidden sm:block mt-1 text-[10px] uppercase tracking-[0.18em] text-white/70">
                  Management System
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:gap-5">
              {!isMobile && <DateTimeDisplay />}
              <NotificationBell />
              <UserDropdown />
            </div>
          </header>

          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </SidebarInset>
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
