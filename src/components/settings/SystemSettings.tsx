import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Settings,
  Database,
  Mail,
  Shield,
  Users,
  FileText,
  ListChecks,
  Palette,
  FileSignature,
  Calculator,
  HardDriveDownload,
  Activity,
  Megaphone,
  RefreshCw,
  MessageSquare,
  Bot,
} from "lucide-react";
import { XeroIntegrationSettings } from "@/components/settings/XeroIntegrationSettings";
import { GeneralSettingsModal } from "@/components/settings/GeneralSettingsModal";
import { UserManagementModal } from "@/components/users/UserManagementModal";
import { SystemLogModal } from "@/components/settings/SystemLogModal";
import { ThemeAppearanceSettings } from "@/components/settings/ThemeAppearanceSettings";
import { EmergencyContactImportModal } from "@/components/contacts/EmergencyContactImportModal";
import { WaiverSettingsCard } from "@/components/settings/WaiverSettingsCard";
import { TaskStatusManagementModal } from "@/components/tasks/TaskStatusManagementModal";
import { AiRetentionSettingsCard } from "@/components/settings/AiRetentionSettingsCard";
import { TeamsChannelNotifyCard } from "@/components/settings/TeamsChannelNotifyCard";
import { IntegrationStatusPanel } from "@/components/datahealth/IntegrationStatusPanel";
import { BackupStatusCard } from "@/components/settings/BackupStatusCard";
import { CrmMigrationConsole } from "@/components/settings/CrmMigrationConsole";
import { BrevoAudienceSyncPanel } from "@/components/settings/BrevoAudienceSyncPanel";
import { SettingsSectionDialog } from "@/components/settings/SettingsSectionDialog";

type SectionKey =
  | "ai"
  | "branding"
  | "waiver"
  | "xero"
  | "backups"
  | "integrations"
  | "audiences"
  | "crm"
  | "teams"
  | null;

export const SystemSettings = () => {
  const [generalSettingsOpen, setGeneralSettingsOpen] = useState(false);
  const [userManagementOpen, setUserManagementOpen] = useState(false);
  const [systemLogOpen, setSystemLogOpen] = useState(false);
  const [emergencyContactImportOpen, setEmergencyContactImportOpen] = useState(false);
  const [taskStatusesOpen, setTaskStatusesOpen] = useState(false);
  const [section, setSection] = useState<SectionKey>(null);

  const closeSection = (open: boolean) => {
    if (!open) setSection(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              General Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Configure global application settings, timezones, and default preferences.
            </div>
            <Button variant="outline" size="sm" onClick={() => setGeneralSettingsOpen(true)}>
              Configure
            </Button>
          </CardContent>
        </Card>

        {/* Branding & Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Branding &amp; Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Theme colours, logos and appearance used across the app and documents.
            </div>
            <Button variant="outline" size="sm" onClick={() => setSection("branding")}>
              Configure
            </Button>
          </CardContent>
        </Card>

        {/* Waiver Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              Waiver Form
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Waiver wording, terms and the settings guests see when signing.
            </div>
            <Button variant="outline" size="sm" onClick={() => setSection("waiver")}>
              Configure
            </Button>
          </CardContent>
        </Card>

        {/* Accounting Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Accounting Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Xero connection, invoice and payment syncing, and contact data fills.
            </div>
            <Button variant="outline" size="sm" onClick={() => setSection("xero")}>
              Manage Xero
            </Button>
          </CardContent>
        </Card>

        {/* Integration Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Integration Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Live connection health for Xero, WordPress, Keap, email and Teams.
            </div>
            <Button variant="outline" size="sm" onClick={() => setSection("integrations")}>
              View Status
            </Button>
          </CardContent>
        </Card>

        {/* Marketing Audiences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Marketing Audiences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Bring Brevo lists into ART as tags, fill contact states and honour unsubscribes.
            </div>
            <Button variant="outline" size="sm" onClick={() => setSection("audiences")}>
              Manage Audiences
            </Button>
          </CardContent>
        </Card>

        {/* CRM migration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              CRM (Keap → Brevo)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Move contacts, tags and notes from Keap into Brevo and keep Brevo connected.
            </div>
            <Button variant="outline" size="sm" onClick={() => setSection("crm")}>
              Open Console
            </Button>
          </CardContent>
        </Card>

        {/* Teams notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Teams Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Choose which Microsoft Teams chats receive task and website update alerts.
            </div>
            <Button variant="outline" size="sm" onClick={() => setSection("teams")}>
              Configure
            </Button>
          </CardContent>
        </Card>

        {/* Backups */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDriveDownload className="h-5 w-5" />
              Backups
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Nightly backup runs, status history and download details.
            </div>
            <Button variant="outline" size="sm" onClick={() => setSection("backups")}>
              View Backups
            </Button>
          </CardContent>
        </Card>

        {/* ART AI */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              ART AI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              How long ART AI conversations are kept before automatic deletion.
            </div>
            <Button variant="outline" size="sm" onClick={() => setSection("ai")}>
              Configure
            </Button>
          </CardContent>
        </Card>

        {/* User Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Manage user accounts, roles, department assignments, and permissions.
            </div>
            <Button variant="outline" size="sm" onClick={() => setUserManagementOpen(true)}>
              Manage Users
            </Button>
          </CardContent>
        </Card>

        {/* Task Statuses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              Task Statuses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Add, rename, reorder or remove the statuses available to tasks.
            </div>
            <Button variant="outline" size="sm" onClick={() => setTaskStatusesOpen(true)}>
              Manage Statuses
            </Button>
          </CardContent>
        </Card>

        {/* System Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              System Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              View system audit logs, security events, and operational history.
            </div>
            <Button variant="outline" size="sm" onClick={() => setSystemLogOpen(true)}>
              View Logs
            </Button>
          </CardContent>
        </Card>

        {/* Database */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Database maintenance and performance monitoring.
            </div>
            <Button variant="outline" size="sm" disabled>
              Manage
              <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
            </Button>
          </CardContent>
        </Card>

        {/* Email Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              SMTP settings, email providers, and delivery configuration.
            </div>
            <Button variant="outline" size="sm" disabled>
              Configure
              <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
            </Button>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security &amp; Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Password policies, session management, and security audit logs.
            </div>
            <Button variant="outline" size="sm" disabled>
              Configure
              <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
            </Button>
          </CardContent>
        </Card>

      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {["Database", "Email Service", "Authentication", "Storage"].map((label) => (
              <div key={label} className="text-center">
                <div className="text-2xl font-bold text-green-600">✓</div>
                <div className="text-sm text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section pop-ups */}
      <SettingsSectionDialog
        open={section === "branding"}
        onOpenChange={closeSection}
        title="Branding & Appearance"
        description="Theme colours, logos and appearance across the app, emails and documents."
      >
        <ThemeAppearanceSettings />
      </SettingsSectionDialog>

      <SettingsSectionDialog
        open={section === "waiver"}
        onOpenChange={closeSection}
        title="Waiver Form"
        description="Configure the waiver guests complete before travel."
      >
        <WaiverSettingsCard />
      </SettingsSectionDialog>

      <SettingsSectionDialog
        open={section === "xero"}
        onOpenChange={closeSection}
        title="Accounting Integration (Xero)"
        description="Connection, invoice and payment syncing, and contact data fills."
      >
        <XeroIntegrationSettings />
      </SettingsSectionDialog>

      <SettingsSectionDialog
        open={section === "integrations"}
        onOpenChange={closeSection}
        title="Integration Status"
        description="Live connection health for Xero, WordPress, Keap, email and Teams."
      >
        <IntegrationStatusPanel />
      </SettingsSectionDialog>

      <SettingsSectionDialog
        open={section === "audiences"}
        onOpenChange={closeSection}
        title="Marketing Audiences"
        description="Bring Brevo lists into ART as tags, fill in contact states and honour Brevo unsubscribes."
      >
        <BrevoAudienceSyncPanel />
      </SettingsSectionDialog>

      <SettingsSectionDialog
        open={section === "crm"}
        onOpenChange={closeSection}
        title="CRM (Keap → Brevo)"
        description="Move contacts, tags and notes from Keap into Brevo, then keep Brevo connected for marketing."
      >
        <CrmMigrationConsole />
      </SettingsSectionDialog>

      <SettingsSectionDialog
        open={section === "teams"}
        onOpenChange={closeSection}
        title="Microsoft Teams Notifications"
      >
        <TeamsChannelNotifyCard />
      </SettingsSectionDialog>

      <SettingsSectionDialog
        open={section === "backups"}
        onOpenChange={closeSection}
        title="Backups"
      >
        <BackupStatusCard />
      </SettingsSectionDialog>

      <SettingsSectionDialog
        open={section === "ai"}
        onOpenChange={closeSection}
        title="ART AI"
        description="Conversation retention for ART AI."
      >
        <AiRetentionSettingsCard />
      </SettingsSectionDialog>

      <GeneralSettingsModal open={generalSettingsOpen} onOpenChange={setGeneralSettingsOpen} />

      <UserManagementModal open={userManagementOpen} onOpenChange={setUserManagementOpen} />

      <SystemLogModal open={systemLogOpen} onOpenChange={setSystemLogOpen} />

      <EmergencyContactImportModal
        open={emergencyContactImportOpen}
        onOpenChange={setEmergencyContactImportOpen}
      />

      <TaskStatusManagementModal open={taskStatusesOpen} onOpenChange={setTaskStatusesOpen} />
    </div>
  );
};
