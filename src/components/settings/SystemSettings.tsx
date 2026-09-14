import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Settings,
  Users,
  FileText,
  ListChecks,
  FileSignature,
  Calculator,
  HardDriveDownload,
  MessageSquare,
  Bot,
  HeartPulse,
} from "lucide-react";
import { XeroIntegrationSettings } from "@/components/settings/XeroIntegrationSettings";
import { GeneralSettingsModal } from "@/components/settings/GeneralSettingsModal";
import { UserManagementModal } from "@/components/users/UserManagementModal";
import { SystemLogModal } from "@/components/settings/SystemLogModal";
import { WaiverSettingsCard } from "@/components/settings/WaiverSettingsCard";
import { TaskStatusManagementModal } from "@/components/tasks/TaskStatusManagementModal";
import { AiRetentionSettingsCard } from "@/components/settings/AiRetentionSettingsCard";
import { TeamsChannelNotifyCard } from "@/components/settings/TeamsChannelNotifyCard";
import { IntegrationStatusPanel } from "@/components/datahealth/IntegrationStatusPanel";
import { BackupStatusCard } from "@/components/settings/BackupStatusCard";
import { SystemHealthCard } from "@/components/settings/SystemHealthCard";
import { SettingsSectionDialog } from "@/components/settings/SettingsSectionDialog";

type SectionKey =
  | "ai"
  | "waiver"
  | "xero"
  | "backups"
  | "health"
  | "teams"
  | null;

export const SystemSettings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [generalSettingsOpen, setGeneralSettingsOpen] = useState(false);
  const [userManagementOpen, setUserManagementOpen] = useState(false);
  const [systemLogOpen, setSystemLogOpen] = useState(false);
  const [taskStatusesOpen, setTaskStatusesOpen] = useState(false);
  const [section, setSection] = useState<SectionKey>(null);

  // Deep links from the global search palette (…&ssec=backups) open the
  // matching card straight away.
  const deepLink = searchParams.get("ssec");
  useEffect(() => {
    if (!deepLink) return;
    const next = new URLSearchParams(searchParams);
    next.delete("ssec");
    setSearchParams(next, { replace: true });

    if (deepLink === "general") setGeneralSettingsOpen(true);
    else if (deepLink === "users") setUserManagementOpen(true);
    else if (deepLink === "logs") setSystemLogOpen(true);
    else if (deepLink === "task-statuses") setTaskStatusesOpen(true);
    else setSection(deepLink as SectionKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink]);

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
              Customer link expiry, timezone display and instalment wording.
            </div>
            <Button variant="outline" size="sm" onClick={() => setGeneralSettingsOpen(true)}>
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

        {/* System Health (now includes integration status) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Background jobs, mailbox syncing, backups, failed emails and live connection status.
            </div>
            <Button variant="outline" size="sm" onClick={() => setSection("health")}>
              View Health
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

      </div>

      {/* Section pop-ups */}
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
        open={section === "teams"}
        onOpenChange={closeSection}
        title="Microsoft Teams Notifications"
      >
        <TeamsChannelNotifyCard />
      </SettingsSectionDialog>

      <SettingsSectionDialog
        open={section === "health"}
        onOpenChange={closeSection}
        title="System Health"
        description="What is running, what has failed recently, whether backups are up to date, and live connection status."
      >
        <div className="space-y-6">
          <SystemHealthCard />
          <IntegrationStatusPanel />
        </div>
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

      <TaskStatusManagementModal open={taskStatusesOpen} onOpenChange={setTaskStatusesOpen} />
    </div>
  );
};
