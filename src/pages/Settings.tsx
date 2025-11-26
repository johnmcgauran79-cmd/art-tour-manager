import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailTemplatesManagement } from "@/components/EmailTemplatesManagement";
import { AutomatedEmailRulesManagement } from "@/components/AutomatedEmailRulesManagement";
import { TaskTemplatesManagement } from "@/components/TaskTemplatesManagement";
import { SystemSettings } from "@/components/SystemSettings";
import { AutomatedReportRulesManagement } from "@/components/AutomatedReportRulesManagement";

interface SettingsProps {
  onBack: () => void;
}

export const Settings = ({ onBack }: SettingsProps) => {
  const [activeTab, setActiveTab] = useState("email-templates");

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-8">
          <TabsTrigger value="email-templates">Email Templates</TabsTrigger>
          <TabsTrigger value="automated-emails">Automated Emails</TabsTrigger>
          <TabsTrigger value="automated-reports">Automated Reports</TabsTrigger>
          <TabsTrigger value="task-templates">Task Templates</TabsTrigger>
          <TabsTrigger value="system">System Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="email-templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Template Management</CardTitle>
              <p className="text-sm text-muted-foreground">
                Create and manage email templates for booking confirmations, dietary requests, and other communications.
              </p>
            </CardHeader>
            <CardContent>
              <EmailTemplatesManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automated-emails" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Automated Email Rules</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure automated emails to be sent at specific intervals before tours start.
              </p>
            </CardHeader>
            <CardContent>
              <AutomatedEmailRulesManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automated-reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Automated Report Distribution</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure automated reports to be emailed on a schedule - weekly, monthly, or days before tours.
              </p>
            </CardHeader>
            <CardContent>
              <AutomatedReportRulesManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="task-templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Task Template Management</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage automated task templates that are created for tours based on dates and milestones.
              </p>
            </CardHeader>
            <CardContent>
              <TaskTemplatesManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure general system settings, integrations, and preferences.
              </p>
            </CardHeader>
            <CardContent>
            <SystemSettings />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};