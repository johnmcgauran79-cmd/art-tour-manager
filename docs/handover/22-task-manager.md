# 22 — Task Manager

One task system serves the whole application. CRM follow-ups, tour operations, website changes and capacity alerts all create ordinary tasks. Do not build a second one.

## Model

| Table | Role |
| --- | --- |
| `tasks` | The task: title, description, category/department, priority, status, due date, tour/booking links |
| `task_statuses` | Configurable status rows on top of the `task_status` enum |
| `task_assignments`, `task_watchers`, `task_approvers` | Who owns it, who follows it, who must approve it |
| `task_subtasks` | Checklist items |
| `task_comments`, `task_comment_attachments`, `task_attachments` | Discussion and files |
| `task_entity_links` | Links to booking / hotel / activity / tour / contact / lead |
| `task_activity_log` | Full audit of changes |
| `task_templates` (+ assignees, approvers) | Reusable task definitions |
| `task_notification_preferences`, `task_notification_log` | Per-user channels and cadence; repeat suppression |

Enums: `task_status` (not_started, in_progress, waiting, completed, cancelled, archived, not_required, with_third_party, awaiting_further_information, approval_required, approved, changes_needed), `task_priority` (low → critical), `task_category` / `department` (operations, finance, marketing, booking, maintenance, general), `task_approval_decision`.

## Behaviour

- **Assignment is strictly by department.** There is no fallback to admins — an unmapped department means nobody is assigned, deliberately.
- Approval flow: `notify_task_approval_request` and `handle_task_approver_decision` drive approval-required statuses and Teams/email notification.
- Automatic generation: `generate_tour_operation_tasks` on tour creation, `create_pending_booking_task`, `create_capacity_monitoring_task`, with matching cleanup functions (`delete_automated_tour_tasks`, `cleanup_activity_generated_tasks`) so cancelled work does not leave orphan tasks.
- Entity links are extracted from task text automatically (`extract_entity_links`, `sync_task_description_links`, `sync_task_comment_links`).
- **Due dates are stored as literal `yyyy-MM-dd` strings**, never ISO timestamps, to avoid timezone drift.
- Replying to a customer never closes a task; completion is explicit.

## Live volume

999 tasks.

## Personal workspace (separate, deliberately)

`personal_todos`, `personal_notes`, `personal_events` plus their share tables are per-user tools for Admin/Manager, with optional sharing and a shared calendar that also shows `staff_leave`. These are **not** the Task Manager and must not be merged with it; a personal to-do can be converted into a real task where that flow exists.
