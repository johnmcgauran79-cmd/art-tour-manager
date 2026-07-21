import type { ComponentType } from "react";
import { RecentBookingsWidget } from "@/components/dashboard/RecentBookingsWidget";
import { StatusAlertWidget } from "@/components/dashboard/StatusAlertWidget";
import { InformationMissingWidget } from "@/components/dashboard/InformationMissingWidget";
import { PendingEmailApprovalsWidget } from "@/components/dashboard/PendingEmailApprovalsWidget";
import { EmailIssuesWidget } from "@/components/dashboard/EmailIssuesWidget";
import { AlertsWidget } from "@/components/dashboard/AlertsWidget";
import { MyApprovalsWidget } from "@/components/dashboard/MyApprovalsWidget";
import type { LayoutItem } from "react-grid-layout/legacy";

export interface DashboardWidgetDef {
  id: string;
  title: string;
  Component: ComponentType;
  default: LayoutItem;
}

// 12-column grid. rowHeight is 60px in the grid.
// x/y in grid units, w/h in grid units. minW/minH keep widgets usable.
export const DASHBOARD_WIDGETS: DashboardWidgetDef[] = [
  {
    id: "recent_bookings",
    title: "Recent Bookings",
    Component: RecentBookingsWidget,
    default: { i: "recent_bookings", x: 0, y: 0, w: 8, h: 10, minW: 4, minH: 4 },
  },
  {
    id: "status_alerts",
    title: "Status Alerts",
    Component: StatusAlertWidget,
    default: { i: "status_alerts", x: 8, y: 0, w: 4, h: 3, minW: 3, minH: 2 },
  },
  {
    id: "my_approvals",
    title: "My Approvals",
    Component: MyApprovalsWidget,
    default: { i: "my_approvals", x: 8, y: 3, w: 4, h: 2, minW: 3, minH: 2 },
  },
  {
    id: "info_missing",
    title: "Information Missing",
    Component: InformationMissingWidget,
    default: { i: "info_missing", x: 8, y: 5, w: 4, h: 3, minW: 3, minH: 2 },
  },
  {
    id: "email_issues",
    title: "Email Delivery Issues",
    Component: EmailIssuesWidget,
    default: { i: "email_issues", x: 8, y: 8, w: 4, h: 3, minW: 3, minH: 2 },
  },
  {
    id: "pending_email_approvals",
    title: "Pending Email Approvals",
    Component: PendingEmailApprovalsWidget,
    default: { i: "pending_email_approvals", x: 8, y: 11, w: 4, h: 3, minW: 3, minH: 2 },
  },
  {
    id: "alerts",
    title: "Alerts",
    Component: AlertsWidget,
    default: { i: "alerts", x: 0, y: 10, w: 12, h: 6, minW: 4, minH: 3 },
  },
];

export const DEFAULT_LAYOUT: LayoutItem[] = DASHBOARD_WIDGETS.map((w) => w.default);
export const DEFAULT_HIDDEN: string[] = [];