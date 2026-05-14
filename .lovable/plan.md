## Goal

Add a "Task Notifications" button next to **Add Task** on the Tasks tab and Action Items area. It opens a per-user preferences modal that controls:

1. **Due-soon alerts** (multi-threshold + overdue reminders)
2. **Upcoming-task digests** (daily / weekly / chosen weekdays, configurable look-ahead)
3. **Channel** (Teams, Email, or Both) — independent for alerts vs digests
4. **Scope** (assigned / watching / mentioned — user-configurable)
5. **Filters** (priority, include subtasks, include overdue section)

Each user manages their own settings only.

---

## Database

New table **`task_notification_preferences`** (one row per user):

- `user_id` (PK, FK profiles)
- **Channels**: `alerts_channel`, `digest_channel` — enum `email | teams | both | off`
- **Scope**: `scope_assigned`, `scope_watching`, `scope_mentioned` (booleans)
- **Due-soon alerts**:
  - `alert_thresholds_hours` int[] (e.g. `{168, 24, 2}` = 7d / 24h / 2h before due)
  - `alert_on_overdue` bool
  - `overdue_reminder_interval_hours` int (e.g. 24 = once a day while overdue)
  - `alert_priority_filter` text[] (empty = all; e.g. `{high,urgent}`)
- **Digests**:
  - `digest_enabled` bool
  - `digest_cadence` enum `daily | weekly | custom_weekdays`
  - `digest_weekdays` int[] (0–6, Mon=1)
  - `digest_time_local` time (e.g. `08:00`)
  - `digest_lookahead_days` int (default 7)
  - `digest_include_overdue`, `digest_include_due_today`, `digest_include_upcoming`, `digest_include_newly_assigned`, `digest_include_watched`, `digest_include_subtasks` (booleans)
  - `digest_priority_filter` text[]
- `last_digest_sent_at` timestamptz

Plus a **`task_notification_log`** table to dedupe sends (`user_id`, `task_id`, `threshold_hours`, `kind`, `sent_at`) so a 24h alert isn't sent twice.

RLS: each user can select/insert/update their own row. Admins (via `has_role`) can read.

---

## Edge functions

1. **`process-task-due-alerts`** — runs every 15 min via pg_cron.
   - For each user pref with alerts enabled, find tasks in scope that cross a threshold within the last 15 min, plus overdue tasks ready for next reminder.
   - Render an alert (subject + html) per task, send via existing `send-task-notification` channel logic (Teams + Email + suppression dedupe through `task_notification_log`).

2. **`process-task-digests`** — runs every 15 min via pg_cron.
   - For each user pref with digest enabled where local clock has just passed `digest_time_local` on a matching weekday and `last_digest_sent_at` is older than 12h: build sections (Overdue / Due today / Next X days / Newly assigned since last digest / Watched), apply priority filter, send via chosen channel, update `last_digest_sent_at`.
   - Skip empty digests if user toggles "Skip if nothing".

Both functions reuse the existing email header + Teams adapter from `send-task-notification` / `send-teams-notification`.

---

## Frontend

- **`useTaskNotificationPreferences.ts`** — fetch/upsert hook for current user's prefs (with defaults if no row).
- **`TaskNotificationsModal.tsx`** — tabbed dialog:
  - **Channels** (alerts vs digest, each Email / Teams / Both / Off)
  - **Scope** (3 checkboxes)
  - **Due alerts** (toggle per threshold chip: 7d / 3d / 24h / 4h / 1h, custom add; overdue toggle + reminder interval; priority multi-select)
  - **Digests** (cadence radio; weekday picker if custom; time picker; look-ahead days slider 1–30; section checkboxes; priority multi-select)
  - "Send test now" button that invokes the digest function once for the current user
- Add **Bell icon button "Task Notifications"** next to **Add Task** in:
  - `src/components/TourTasksTab.tsx`
  - `src/pages/Index.tsx` Action Items area (existing tasks section)
  - Global `/tasks` view if present

---

## Out of scope

- No org-wide defaults, no admin-on-behalf editing, no SMS, no push.
- Existing per-event notifications (assignment / mention / subtask) remain unchanged — these new prefs are additive.

---

## Files

- New: `supabase/migrations/<ts>_task_notification_preferences.sql`
- New: `supabase/functions/process-task-due-alerts/index.ts`
- New: `supabase/functions/process-task-digests/index.ts`
- New: `src/hooks/useTaskNotificationPreferences.ts`
- New: `src/components/tasks/TaskNotificationsModal.tsx`
- Edit: `src/components/TourTasksTab.tsx`, `src/pages/Index.tsx` (and any other Tasks list header)
