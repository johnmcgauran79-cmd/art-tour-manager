import type { ComponentType } from "react";
import { RecentBookingsWidget } from "@/components/dashboard/RecentBookingsWidget";
import { StatusAlertWidget } from "@/components/dashboard/StatusAlertWidget";
import { InformationMissingWidget } from "@/components/dashboard/InformationMissingWidget";
import { PendingEmailApprovalsWidget } from "@/components/dashboard/PendingEmailApprovalsWidget";
import { EmailIssuesWidget } from "@/components/dashboard/EmailIssuesWidget";
import { AlertsWidget } from "@/components/dashboard/AlertsWidget";
import { MyApprovalsWidget } from "@/components/dashboard/MyApprovalsWidget";
import { MyTasksWidget } from "@/components/dashboard/MyTasksWidget";
import { MyTodosWidget } from "@/components/dashboard/MyTodosWidget";
import { UpcomingCommsWidget } from "@/components/dashboard/UpcomingCommsWidget";
import { WebsiteChangesWidget } from "@/components/dashboard/WebsiteChangesWidget";
import type { LayoutItem } from "react-grid-layout/legacy";

export interface DashboardWidgetDef {
  id: string;
  title: string;
  Component: ComponentType;
  default: LayoutItem;
}

export const DASHBOARD_LAYOUT_VERSION = 5;

// 12-column grid. Default widgets span all 12 columns for a single-column start.
// x/y in grid units, w/h in grid units. minW/minH keep widgets usable.
// 12-col grid, three columns => w=4. Each widget occupies one column.
export const DASHBOARD_WIDGETS: DashboardWidgetDef[] = [
  {
    id: "recent_bookings",
    title: "Recent Bookings",
    Component: RecentBookingsWidget,
    default: { i: "recent_bookings", x: 0, y: 0, w: 4, h: 10, minW: 3, minH: 4 },
  },
  {
    id: "status_alerts",
    title: "Status Alerts",
    Component: StatusAlertWidget,
    default: { i: "status_alerts", x: 4, y: 0, w: 4, h: 10, minW: 3, minH: 3 },
  },
  {
    id: "my_approvals",
    title: "My Approvals",
    Component: MyApprovalsWidget,
    default: { i: "my_approvals", x: 8, y: 0, w: 4, h: 10, minW: 3, minH: 2 },
  },
  {
    id: "my_tasks",
    title: "My Tasks",
    Component: MyTasksWidget,
    default: { i: "my_tasks", x: 0, y: 10, w: 4, h: 10, minW: 3, minH: 3 },
  },
  {
    id: "my_todos",
    title: "My To-Do List",
    Component: MyTodosWidget,
    default: { i: "my_todos", x: 4, y: 10, w: 4, h: 10, minW: 3, minH: 3 },
  },
  {
    id: "info_missing",
    title: "Information Missing",
    Component: InformationMissingWidget,
    default: { i: "info_missing", x: 8, y: 10, w: 4, h: 10, minW: 3, minH: 2 },
  },
  {
    id: "email_issues",
    title: "Email Delivery Issues",
    Component: EmailIssuesWidget,
    default: { i: "email_issues", x: 0, y: 20, w: 4, h: 10, minW: 3, minH: 3 },
  },
  {
    id: "pending_email_approvals",
    title: "Pending Email Approvals",
    Component: PendingEmailApprovalsWidget,
    default: { i: "pending_email_approvals", x: 4, y: 20, w: 4, h: 10, minW: 3, minH: 3 },
  },
  {
    id: "alerts",
    title: "Alerts",
    Component: AlertsWidget,
    default: { i: "alerts", x: 8, y: 20, w: 4, h: 10, minW: 3, minH: 4 },
  },
  {
    id: "upcoming_comms",
    title: "Upcoming Comms",
    Component: UpcomingCommsWidget,
    default: { i: "upcoming_comms", x: 0, y: 30, w: 4, h: 10, minW: 3, minH: 3 },
  },
  {
    id: "website_changes",
    title: "Approve Website Changes",
    Component: WebsiteChangesWidget,
    default: { i: "website_changes", x: 4, y: 30, w: 4, h: 10, minW: 3, minH: 3 },
  },
];

export const DEFAULT_LAYOUT: LayoutItem[] = DASHBOARD_WIDGETS.map((w) => ({
  ...w.default,
  dashboardVersion: DASHBOARD_LAYOUT_VERSION,
} as LayoutItem));
export const DEFAULT_HIDDEN: string[] = [];