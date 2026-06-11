## Goal

Turn the ART system into a daily workspace by adding per-user personal productivity tools and replacing the top-tab navigation with a collapsible, mobile-friendly sidebar.

## 1. Navigation: top tabs → collapsible sidebar

Replace the `AppLayout` top-tab bar with a shadcn `Sidebar` (`collapsible="icon"`).

- **Desktop**: left sidebar, collapses to a narrow icon rail. Brand header + ART logo at top. Trigger always visible in a slim top app bar (keeps DateTime, Notifications, User dropdown).
- **Mobile / hosts on the go**: sidebar uses off-canvas sheet behaviour (shadcn default on mobile) opened by a hamburger in the top bar — full-width tap targets, closes on navigate. Hosts (who only see Tours) get a minimal menu.
- Same role gating as today: dashboard/operations/contacts/settings hidden for agents & hosts; Tasks + new personal tools = Admin/Manager only; Tours for everyone; Bookings hidden for hosts.
- Nav items get lucide icons. Active route highlighting via `useLocation`.
- New "My Workspace" group in the sidebar (Admin/Manager only): **To-Do**, **Notes**, **Calendar**.

```text
┌────────────┬───────────────────────────┐
│ [ART logo] │  top bar: ☰  …  🔔  user   │
│ Dashboard  ├───────────────────────────┤
│ Operations │                           │
│ Tasks      │        page content       │
│ Tours      │                           │
│ Bookings   │                           │
│ Contacts   │                           │
│ Settings   │                           │
│ ── My ──   │                           │
│ To-Do      │                           │
│ Notes      │                           │
│ Calendar   │                           │
└────────────┴───────────────────────────┘
```

## 2. Personal To-Do list (Admin/Manager)

Quick private checklist, fully separate from the Tasks system.
- New table `personal_todos` (user_id, title, completed, position/order, optional due date).
- UI: single column, add-on-enter input, check to complete, inline edit, delete, drag-to-reorder, "show/hide completed".
- Strictly private — RLS scoped to `auth.uid()`.

## 3. Personal Notes (Admin/Manager)

Simple rich-text notes, searchable.
- New table `personal_notes` (user_id, title, content (HTML), pinned, updated_at).
- UI: list/sidebar of notes + editor pane. Reuse the existing Quill rich-text editor used elsewhere. Search by title/content, pin to top, autosave on blur, delete with confirm.
- Private — RLS scoped to `auth.uid()`.

## 4. Personal Calendar (Admin/Manager)

Month/agenda calendar overlaying three sources:
- **Personal events** — new table `personal_events` (user_id, title, description, start, end, all_day, colour). Full create/edit/delete.
- **My Tasks** — tasks assigned to the current user, shown on their due dates (read-only, click → task detail).
- **Tours** — tours the user is involved with, shown across their date range (read-only, click → tour).
- Month grid + list/agenda view. Australian dd/mm/yyyy formatting throughout. Mobile = agenda list by default.

## Technical notes

- Routes: `/todos`, `/notes`, `/calendar` (guarded to Admin/Manager, redirect others like Tasks does).
- Three migrations, each: `CREATE TABLE` → `GRANT` (authenticated + service_role, no anon) → enable RLS → policies scoped to `auth.uid()` → `updated_at` trigger.
- Data fetching via React Query hooks (`usePersonalTodos`, `usePersonalNotes`, `usePersonalEvents`) following existing hook patterns.
- All dates stored/handled timezone-safe; due dates as literal `yyyy-MM-dd` per project rules.
- Calendar lib: lightweight custom month grid built on existing `date-fns` + shadcn (avoids heavy deps); reuse `Calendar` primitives where helpful.

## Suggested build order

1. Sidebar navigation (foundation — everything hangs off it).
2. Personal To-Do.
3. Personal Notes.
4. Personal Calendar.

I can build all four in this round, or stop after the sidebar so you can review the new shell first.