import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, Database, Mail, Shield, Users, FileText, Upload } from "lucide-react";
import { XeroIntegrationSettings } from "./XeroIntegrationSettings";
import { GeneralSettingsModal } from "./GeneralSettingsModal";
import { UserManagementModal } from "./UserManagementModal";
import { SystemLogModal } from "./SystemLogModal";
import { ThemeAppearanceSettings } from "./ThemeAppearanceSettings";
import { EmailHeaderSettingsCard } from "./EmailHeaderSettingsCard";
import { EmergencyContactImportModal } from "./EmergencyContactImportModal";
import { WaiverSettingsCard } from "./WaiverSettingsCard";

interface SystemSettingsProps {
  // Remove the external handlers since we'll handle modals internally
}

export const SystemSettings = ({ }: SystemSettingsProps) => {
  const [generalSettingsOpen, setGeneralSettingsOpen] = useState(false);
  const [userManagementOpen, setUserManagementOpen] = useState(false);
  const [systemLogOpen, setSystemLogOpen] = useState(false);
  const [emergencyContactImportOpen, setEmergencyContactImportOpen] = useState(false);

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
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setGeneralSettingsOpen(true)}
            >
              Configure
            </Button>
          </CardContent>
        </Card>

        {/* Database Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Database maintenance, backups, and performance monitoring.
            </div>
            <Button variant="outline" size="sm" disabled>
              Manage
              <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
            </Button>
          </CardContent>
        </Card>

        {/* Email Settings */}
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

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security & Access
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
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setUserManagementOpen(true)}
            >
              Manage Users
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
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSystemLogOpen(true)}
            >
              View Logs
            </Button>
          </CardContent>
        </Card>

      </div>

      {/* Theme & Appearance */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Branding & Appearance</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ThemeAppearanceSettings />
          <EmailHeaderSettingsCard />
        </div>
      </div>

      {/* Data Import Section - Hidden for now, kept for potential reuse
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Data Import</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="h-5 w-5" />
                Emergency Contacts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Bulk import emergency contact details from a CSV file to update existing contacts.
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setEmergencyContactImportOpen(true)}
              >
                Import CSV
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      */}

      {/* Waiver Form */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Waiver Form</h2>
        <WaiverSettingsCard />
      </div>

      {/* Xero Integration */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Accounting Integration</h2>
        <XeroIntegrationSettings />
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">✓</div>
              <div className="text-sm text-muted-foreground">Database</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">✓</div>
              <div className="text-sm text-muted-foreground">Email Service</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">✓</div>
              <div className="text-sm text-muted-foreground">Authentication</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">✓</div>
              <div className="text-sm text-muted-foreground">Storage</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <GeneralSettingsModal 
        open={generalSettingsOpen} 
        onOpenChange={setGeneralSettingsOpen} 
      />
      
      <UserManagementModal 
        open={userManagementOpen} 
        onOpenChange={setUserManagementOpen} 
      />
      
      <SystemLogModal 
        open={systemLogOpen} 
        onOpenChange={setSystemLogOpen} 
      />

      <EmergencyContactImportModal
        open={emergencyContactImportOpen}
        onOpenChange={setEmergencyContactImportOpen}
      />
    </div>
  );
};