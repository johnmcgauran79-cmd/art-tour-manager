
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Clock, XCircle, Settings, List, Plus, TrendingUp, Bell } from "lucide-react";
import { MyTasksWidget } from "@/components/MyTasksWidget";
import { TaskTemplatesManagement } from "@/components/TaskTemplatesManagement";
import { AllTasksView } from "@/components/AllTasksView";
import { MyNotificationsWidget } from "@/components/MyNotificationsWidget";
import { useAuth } from "@/hooks/useAuth";

const operationsData = [
  {
    tourName: "Melbourne Cup Carnival 2024",
    hotelStatus: "confirmed",
    activityStatus: "pending",
    issues: ["Transport pickup time TBC"],
    overbooked: false
  },
  {
    tourName: "Formula 1 Australian Grand Prix",
    hotelStatus: "confirmed",
    activityStatus: "confirmed",
    issues: [],
    overbooked: false
  },
  {
    tourName: "Bathurst 1000 Experience",
    hotelStatus: "pending",
    activityStatus: "enquiry-sent",
    issues: ["Hotel response overdue", "Activity capacity issue"],
    overbooked: true
  }
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case "confirmed": return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "pending": return <Clock className="h-4 w-4 text-yellow-600" />;
    case "enquiry-sent": return <Clock className="h-4 w-4 text-blue-600" />;
    default: return <XCircle className="h-4 w-4 text-red-600" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "confirmed": return "bg-green-100 text-green-800";
    case "pending": return "bg-yellow-100 text-yellow-800";
    case "enquiry-sent": return "bg-blue-100 text-blue-800";
    default: return "bg-red-100 text-red-800";
  }
};

export const OperationsDashboard = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'templates' | 'allTasks' | 'allNotifications'>('dashboard');
  const { userRole } = useAuth();

  // Check if user has admin or manager role
  const canManageTemplates = userRole === 'admin' || userRole === 'manager';

  if (currentView === 'templates') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-brand-navy">Task Template Management</h2>
          <Button
            variant="outline"
            onClick={() => setCurrentView('dashboard')}
          >
            Back to Operations
          </Button>
        </div>
        <TaskTemplatesManagement />
      </div>
    );
  }

  if (currentView === 'allTasks') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-brand-navy">All My Tasks</h2>
          <Button
            variant="outline"
            onClick={() => setCurrentView('dashboard')}
          >
            Back to Operations
          </Button>
        </div>
        <AllTasksView />
      </div>
    );
  }

  if (currentView === 'allNotifications') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-brand-navy">All My Notifications</h2>
          <Button
            variant="outline"
            onClick={() => setCurrentView('dashboard')}
          >
            Back to Operations
          </Button>
        </div>
        <Card className="border-brand-navy/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-brand-navy flex items-center gap-2">
              <Bell className="h-5 w-5" />
              All Notifications
            </CardTitle>
            <CardDescription>
              View and manage all your notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MyNotificationsWidget />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Simplified Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-brand-navy flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            Operations Center
          </h2>
          <p className="text-muted-foreground mt-1">
            Your central hub for task management and operational oversight
          </p>
        </div>
        <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy">
          All Users Access
        </Badge>
      </div>

      {/* Notifications Widget */}
      <Card className="border-brand-navy/20 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-brand-navy" />
              <CardTitle className="text-brand-navy">Recent Notifications</CardTitle>
              <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy">
                Latest Updates
              </Badge>
            </div>
            <Button
              onClick={() => setCurrentView('allNotifications')}
              size="sm"
              variant="outline"
              className="flex items-center gap-2"
            >
              <List className="h-4 w-4" />
              View All Notifications
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <MyNotificationsWidget />
        </CardContent>
      </Card>

      {/* My Tasks Widget - Top 5 Most Urgent */}
      <Card className="border-brand-navy/20 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-brand-navy" />
              <CardTitle className="text-brand-navy">My Priority Tasks</CardTitle>
              <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy">
                Top 5 Most Urgent
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {canManageTemplates && (
                <Button
                  onClick={() => setCurrentView('templates')}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Manage Templates
                </Button>
              )}
              <Button
                onClick={() => setCurrentView('allTasks')}
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
              >
                <List className="h-4 w-4" />
                View All Tasks
              </Button>
              <Button
                size="sm"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Task
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <MyTasksWidget hideAddButton={true} limitToTop5={true} />
        </CardContent>
      </Card>

      {/* Operations Overview - Tours Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Current Tours Operations Status
          </CardTitle>
          <CardDescription>
            Monitor tour status, capacity issues, and operational requirements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {operationsData.map((tour, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-semibold text-lg">{tour.tourName}</h3>
                  {tour.overbooked && (
                    <Badge className="bg-red-100 text-red-800">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      OVERBOOKED
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center justify-between p-3 bg-accent/50 rounded">
                    <span className="font-medium">Hotel Status</span>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(tour.hotelStatus)}
                      <Badge className={getStatusColor(tour.hotelStatus)}>
                        {tour.hotelStatus.replace("-", " ").toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-accent/50 rounded">
                    <span className="font-medium">Activity Status</span>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(tour.activityStatus)}
                      <Badge className={getStatusColor(tour.activityStatus)}>
                        {tour.activityStatus.replace("-", " ").toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </div>

                {tour.issues.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <h4 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Issues Requiring Attention
                    </h4>
                    <ul className="text-sm text-red-700 space-y-1">
                      {tour.issues.map((issue, issueIndex) => (
                        <li key={issueIndex} className="flex items-center gap-2">
                          <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
