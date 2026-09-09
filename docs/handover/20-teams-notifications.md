# 20 — Teams and in-app notifications

## Microsoft Teams

Uses the same Entra app registration as mailbox sync (see [15-microsoft-email.md](15-microsoft-email.md)).

| Function | Purpose |
| --- | --- |
| `teams-oauth-start` / `teams-oauth-callback` / `teams-disconnect` | Per-user Teams connection |
| `send-teams-notification` | Generic sender |
| `notify-tour-status-teams` | Tour status changes |
| `notify-website-change-teams` | Website change requests |

| Table | Role |
| --- | --- |
| `user_teams_connections` | Per-user connection state |
| `teams_oauth_states` | Short-lived OAuth state |
| `teams_channel_notify_config` | Channel routing configuration |

Notifications currently cover: tour status changes, task assignment and due alerts, task approval requests, and website change requests. Delivery is per-user based on `task_notification_preferences` (channel can be off / email / Teams / both).

If a user has never connected Teams, Teams-channel notifications for them silently do nothing; email remains the fallback.

## In-app notifications

`user_notifications` plus `user_notification_dismissals` drive the bell in the header (`NotificationBell.tsx`). Dismissals are per user, so one person clearing a notification does not clear it for others.

## Task notification pipeline

`send-task-notification` (immediate), `process-task-due-alerts` (every 15 minutes), `process-task-digests` (every 15 minutes, honouring each user's digest cadence: daily, weekly or chosen weekdays). Sent notifications are logged in `task_notification_log` to prevent repeats.
