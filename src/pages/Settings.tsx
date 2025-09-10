import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { EmailTemplatesManagement } from "@/components/EmailTemplatesManagement";
import { TaskTemplatesManagement } from "@/components/TaskTemplatesManagement";
import { SystemSettings } from "@/components/SystemSettings";

interface SettingsProps {
  onBack: () => void;
}

export const Settings = ({ onBack }: SettingsProps) => {
  const [activeTab, setActiveTab] = useState("email-templates");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="email-templates">Email Templates</TabsTrigger>
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
    </div>
  );
};