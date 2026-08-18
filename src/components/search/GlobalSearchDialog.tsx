import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  BookOpen,
  Bot,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  LayoutDashboard,
  Loader2,
  Mail,
  Map,
  StickyNote,
  Users,
} from "lucide-react";
import { useGlobalSearch, type GlobalSearchKind } from "@/hooks/useGlobalSearch";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdminOrManager } from "@/hooks/useUserRoles";

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const KIND_META: Record<GlobalSearchKind, { label: string; icon: typeof Map }> = {
  tour: { label: "Tours", icon: Map },
  booking: { label: "Bookings", icon: BookOpen },
  contact: { label: "Contacts", icon: Users },
  task: { label: "Tasks", icon: CheckSquare },
};

const KIND_ORDER: GlobalSearchKind[] = ["tour", "booking", "contact", "task"];

export const GlobalSearchDialog = ({ open, onOpenChange }: GlobalSearchDialogProps) => {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const { isAdminOrManager } = useIsAdminOrManager();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");

  const isAgent = userRole === "agent";
  const isHost = userRole === "host";

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(term), 250);
    return () => window.clearTimeout(id);
  }, [term]);

  useEffect(() => {
    if (!open) {
      setTerm("");
      setDebounced("");
    }
  }, [open]);

  const { data: results = [], isFetching } = useGlobalSearch(debounced);

  // Restricted roles only ever see the records they can open.
  const allowedKinds = useMemo<GlobalSearchKind[]>(() => {
    if (isHost) return ["tour"];
    if (isAgent) return ["tour", "booking"];
    return KIND_ORDER;
  }, [isAgent, isHost]);

  const grouped = useMemo(() => {
    return allowedKinds
      .map((kind) => ({ kind, items: results.filter((r) => r.kind === kind) }))
      .filter((g) => g.items.length > 0);
  }, [results, allowedKinds]);

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const navItems = useMemo(() => {
    const items: { label: string; icon: typeof Map; path: string }[] = [];
    if (!isAgent && !isHost) items.push({ label: "Dashboard", icon: LayoutDashboard, path: "/?tab=dashboard" });
    items.push({ label: "Tours", icon: Map, path: "/?tab=tours" });
    if (!isHost) items.push({ label: "Bookings", icon: BookOpen, path: "/?tab=bookings" });
    if (!isAgent && !isHost) {
      items.push({ label: "Contacts", icon: Users, path: "/?tab=contacts" });
      items.push({ label: "Operations", icon: ClipboardList, path: "/?tab=operations" });
      items.push({ label: "Ask ART AI", icon: Bot, path: "/art-ai" });
    }
    if (isAdminOrManager) {
      items.push({ label: "Tasks", icon: CheckSquare, path: "/?tab=tasks" });
      items.push({ label: "Communications", icon: Mail, path: "/communications" });
      items.push({ label: "To-Do", icon: CheckSquare, path: "/todos" });
      items.push({ label: "Notes", icon: StickyNote, path: "/notes" });
      items.push({ label: "Calendar", icon: CalendarDays, path: "/calendar" });
    }
    return items;
  }, [isAgent, isHost, isAdminOrManager]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search tours, bookings, contacts, tasks…"
        value={term}
        onValueChange={setTerm}
      />
      <CommandList>
        {debounced.length >= 2 && isFetching && (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching…
          </div>
        )}

        {debounced.length >= 2 && !isFetching && grouped.length === 0 && (
          <CommandEmpty>No matches for “{debounced}”.</CommandEmpty>
        )}

        {grouped.map(({ kind, items }, index) => {
          const Icon = KIND_META[kind].icon;
          return (
            <div key={kind}>
              {index > 0 && <CommandSeparator />}
              <CommandGroup heading={KIND_META[kind].label}>
                {items.map((item) => (
                  <CommandItem
                    key={`${kind}-${item.id}`}
                    value={`${kind}-${item.id}-${item.title} ${item.subtitle ?? ""}`}
                    onSelect={() => go(item.path)}
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{item.title}</span>
                    {item.subtitle && (
                      <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">
                        {item.subtitle}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          );
        })}

        {grouped.length > 0 && <CommandSeparator />}

        <CommandGroup heading="Go to">
          {navItems.map((item) => (
            <CommandItem
              key={item.path}
              value={`goto ${item.label}`}
              onSelect={() => go(item.path)}
              className="gap-2"
            >
              <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};
