import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, Database, Mail, Shield, Users, FileText } from "lucide-react";

export const SystemSettings = () => {
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
              Configure global application settings, time zones, and default preferences.
            </div>
            <Button variant="outline" size="sm" disabled>
              Configure
              <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
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
              User Roles & Departments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Manage user roles, department assignments, and permissions.
            </div>
            <Button variant="outline" size="sm" disabled>
              Manage
              <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
            </Button>
          </CardContent>
        </Card>

        {/* Integration Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Integrations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Configure external integrations, APIs, and third-party services.
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
    </div>
  );
};