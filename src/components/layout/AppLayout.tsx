import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SecondaryContextBar } from "@/components/layout/SecondaryContextBar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { UserDropdown } from "@/components/UserDropdown";
import { ShareButton } from "@/components/ShareButton";
import { GlobalSearchDialog } from "@/components/search/GlobalSearchDialog";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);

  // Global shortcuts: Ctrl/Cmd+K opens search, Ctrl/Cmd+J opens ART AI.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (key === "j") {
        e.preventDefault();
        navigate("/art-ai");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchOpen(true)}
              className="gap-2 text-brand-yellow hover:bg-white/10 hover:text-brand-yellow"
              aria-label="Search everything"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
              {!isMobile && (
                <kbd className="hidden rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-medium lg:inline">
                  ⌘K
                </kbd>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/art-ai")}
              className="gap-2 text-brand-yellow hover:bg-white/10 hover:text-brand-yellow"
              aria-label="Ask ART AI"
            >
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">Ask ART AI</span>
              {!isMobile && (
                <kbd className="hidden rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-medium lg:inline">
                  ⌘J
                </kbd>
              )}
            </Button>
            <NotificationBell />
            <UserDropdown />
          </div>
        </header>

        {/* Secondary context bar: date, timezones, next tour, staff leave */}
        {!isMobile && <SecondaryContextBar />}

        {/* Below header: menu on the left, main panel on the right */}
        <div className="flex flex-1 w-full min-h-0 overflow-hidden">
          <AppSidebar />
          <main className="flex-1 min-w-0 overflow-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="max-w-7xl w-full mx-auto">{children}</div>
          </main>
        </div>
      </div>

      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

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
