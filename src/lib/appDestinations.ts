// Static registry of app destinations — pages, settings cards and tools — so the
// header search can find features by name ("backup", "waiver", "Xero") the same
// way it finds tours, bookings and contacts.

export type DestinationAccess = "all" | "staff" | "adminManager" | "admin";

export interface AppDestination {
  id: string;
  label: string;
  /** Where it lives, shown as the right-hand hint. */
  group: string;
  /** Extra words users might type. */
  keywords: string;
  path: string;
  access: DestinationAccess;
}

const S = (stab: string, extra = "") => `/?tab=settings&stab=${stab}${extra}`;

export const APP_DESTINATIONS: AppDestination[] = [
  // ---- Main pages ----
  { id: "dashboard", label: "Dashboard", group: "Pages", keywords: "home overview widgets alerts", path: "/?tab=dashboard", access: "staff" },
  { id: "tours", label: "Tours", group: "Pages", keywords: "trips departures itineraries", path: "/?tab=tours", access: "all" },
  { id: "bookings", label: "Bookings", group: "Pages", keywords: "reservations passengers pax", path: "/?tab=bookings", access: "all" },
  { id: "contacts", label: "Contacts", group: "Pages", keywords: "customers clients people database", path: "/?tab=contacts", access: "staff" },
  { id: "operations", label: "Operations", group: "Pages", keywords: "ops reports rooming hotels activities", path: "/?tab=operations", access: "staff" },
  { id: "tasks", label: "Tasks", group: "Pages", keywords: "task manager workflow assignments", path: "/?tab=tasks", access: "adminManager" },
  { id: "reports", label: "Reports", group: "Pages", keywords: "reporting exports csv", path: "/?tab=reports", access: "staff" },
  { id: "art-ai", label: "Ask ART AI", group: "Pages", keywords: "ai assistant chat questions", path: "/art-ai", access: "staff" },
  { id: "communications", label: "Communications", group: "Pages", keywords: "emails sent inbox history messages", path: "/communications", access: "adminManager" },
  { id: "marketing", label: "Marketing", group: "Pages", keywords: "campaigns edm audiences newsletters forms landing pages submissions results", path: "/marketing", access: "adminManager" },
  { id: "leads", label: "Leads & Enquiries", group: "Pages", keywords: "crm sales pipeline enquiries prospects", path: "/leads", access: "adminManager" },
  { id: "todos", label: "My To-Do list", group: "Pages", keywords: "todo personal checklist", path: "/todos", access: "adminManager" },
  { id: "notes", label: "My Notes", group: "Pages", keywords: "notes notepad personal", path: "/notes", access: "adminManager" },
  { id: "calendar", label: "Calendar", group: "Pages", keywords: "diary schedule leave events", path: "/calendar", access: "adminManager" },
  { id: "wordpress", label: "Website Content (WordPress)", group: "Pages", keywords: "wordpress website sync inclusions itinerary pages", path: "/wordpress-content", access: "adminManager" },

  // ---- Data health / quality ----
  { id: "data-health", label: "Tour Readiness & Data Health", group: "Tools", keywords: "checks readiness integration status", path: "/data-health", access: "adminManager" },
  { id: "data-quality", label: "Data Quality (duplicates, missing details)", group: "Tools", keywords: "duplicates missing phone numbers invoices clean up review data", path: "/data-quality", access: "adminManager" },

  // ---- Operations tools ----
  { id: "ops-activities", label: "Activity Bookings", group: "Operations", keywords: "activities allocations experiences", path: "/operations/activity-bookings", access: "staff" },
  { id: "ops-hotels", label: "Hotel Allocations", group: "Operations", keywords: "hotels rooming list accommodation", path: "/operations/hotel-allocations", access: "staff" },
  { id: "ops-changes", label: "Booking Changes", group: "Operations", keywords: "amendments changes log", path: "/operations/booking-changes", access: "staff" },
  { id: "ops-payments", label: "Payment Status", group: "Operations", keywords: "payments outstanding deposits invoices finance", path: "/operations/payment-status", access: "staff" },
  { id: "ops-phones", label: "Missing Phone Numbers", group: "Operations", keywords: "phone mobile missing contact details", path: "/operations/missing-phone-numbers", access: "staff" },

  // ---- Settings: email management ----
  { id: "set-email-templates", label: "Email Templates", group: "Settings", keywords: "templates merge fields wording emails", path: S("email-management", "&ssub=templates"), access: "adminManager" },
  { id: "set-automated-emails", label: "Automated Emails", group: "Settings", keywords: "automation rules triggers approvals scheduled", path: S("email-management", "&ssub=automated-emails"), access: "adminManager" },
  { id: "set-automated-reports", label: "Automated Reports", group: "Settings", keywords: "scheduled reports distribution", path: S("email-management", "&ssub=automated-reports"), access: "adminManager" },
  { id: "set-email-settings", label: "Email Settings (sender, reply-to)", group: "Settings", keywords: "from address sender name reply to suppressions bounces headers", path: S("email-management", "&ssub=email-settings"), access: "admin" },
  { id: "set-mailboxes", label: "Outlook Mailboxes", group: "Settings", keywords: "microsoft 365 outlook sync mailbox history", path: S("email-management", "&ssub=mailboxes"), access: "admin" },

  // ---- Settings: other tabs ----
  { id: "set-invoices", label: "Invoice Management", group: "Settings", keywords: "invoice line items payment schedule xero wording", path: S("invoice-management"), access: "admin" },
  { id: "set-task-templates", label: "Task Templates", group: "Settings", keywords: "task templates automation checklists", path: S("task-templates"), access: "adminManager" },
  { id: "set-additional-info", label: "Additional Info & Cancellation Policy", group: "Settings", keywords: "additional information blocks cancellation policy terms", path: S("additional-info"), access: "adminManager" },
  { id: "set-branding", label: "Branding & Appearance (brands, themes, colours)", group: "Settings", keywords: "brand logo colours palette theme fonts sidebar racing breaks", path: S("brands"), access: "admin" },

  // ---- Settings: system cards (admin only) ----
  { id: "set-general", label: "General Settings", group: "Settings", keywords: "link expiry timezone instalment wording tokens", path: S("system", "&ssec=general"), access: "admin" },
  { id: "set-waiver", label: "Waiver Settings", group: "Settings", keywords: "waiver liability signing terms", path: S("system", "&ssec=waiver"), access: "admin" },
  { id: "set-xero", label: "Accounting Integration (Xero)", group: "Settings", keywords: "xero accounting invoices sync connection", path: S("system", "&ssec=xero"), access: "admin" },
  { id: "set-backups", label: "Backups", group: "Settings", keywords: "backup restore database code sharepoint copies disaster recovery", path: S("system", "&ssec=backups"), access: "admin" },
  { id: "set-health", label: "System Health & Integration Status", group: "Settings", keywords: "health status jobs failures connections uptime", path: S("system", "&ssec=health"), access: "admin" },
  { id: "set-teams", label: "Teams Notifications", group: "Settings", keywords: "microsoft teams channel alerts notifications", path: S("system", "&ssec=teams"), access: "admin" },
  { id: "set-ai", label: "ART AI Settings", group: "Settings", keywords: "ai retention history assistant", path: S("system", "&ssec=ai"), access: "admin" },
  { id: "set-users", label: "User Management", group: "Settings", keywords: "users staff roles permissions access accounts passwords", path: S("system", "&ssec=users"), access: "admin" },
  { id: "set-task-statuses", label: "Task Statuses", group: "Settings", keywords: "statuses workflow columns tasks", path: S("system", "&ssec=task-statuses"), access: "admin" },
  { id: "set-logs", label: "System Logs", group: "Settings", keywords: "logs audit history errors activity", path: S("system", "&ssec=logs"), access: "admin" },
];

const norm = (s: string) => s.toLowerCase();

/** Simple word-prefix match across label, group and keywords. */
export const searchAppDestinations = (
  term: string,
  opts: { isAgent: boolean; isHost: boolean; isAdmin: boolean; isAdminOrManager: boolean },
  limit = 6,
): AppDestination[] => {
  const q = norm(term).trim();
  if (q.length < 2) return [];
  const words = q.split(/\s+/);

  const allowed = (a: DestinationAccess) => {
    if (a === "all") return true;
    if (opts.isHost || opts.isAgent) return false;
    if (a === "staff") return true;
    if (a === "adminManager") return opts.isAdminOrManager;
    return opts.isAdmin;
  };

  return APP_DESTINATIONS.filter((d) => {
    if (!allowed(d.access)) return false;
    const haystack = norm(`${d.label} ${d.group} ${d.keywords}`);
    return words.every((w) => haystack.includes(w));
  }).slice(0, limit);
};
