
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TaskTemplatesManagement } from "@/components/tasks/TaskTemplatesManagement";
import { AllTasksView } from "@/components/tasks/AllTasksView";
import { useAuth } from "@/hooks/useAuth";
import { OperationsHeader } from "@/components/operations/OperationsHeader";
import { OperationsQuickActions } from "@/components/operations/OperationsQuickActions";
import { OperationsToursOverview } from "@/components/operations/OperationsToursOverview";
import { OperationsDocumentsTab } from "@/components/operations/OperationsDocumentsTab";

interface OperationsDashboardProps {
  onNavigateToItem?: (type: string, itemId: string, hotelId?: string) => void;
}

export const OperationsDashboard = ({ onNavigateToItem }: OperationsDashboardProps) => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'templates' | 'allTasks'>('dashboard');
  const { userRole } = useAuth();

  // Check if user has admin or manager role
  const canManageTemplates = userRole === 'admin' || userRole === 'manager';

  // Listen for navigation events from dashboard
  useEffect(() => {
    const handleNavigateToAllTasks = () => {
      setCurrentView('allTasks');
    };

    window.addEventListener('navigate-to-all-tasks', handleNavigateToAllTasks);
    
    return () => {
      window.removeEventListener('navigate-to-all-tasks', handleNavigateToAllTasks);
    };
  }, []);

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

  return (
    <Tabs defaultValue="center" className="space-y-6">
      <TabsList>
        <TabsTrigger value="center">Operations Center</TabsTrigger>
        <TabsTrigger value="working">Working Documents</TabsTrigger>
        <TabsTrigger value="policies">Policies and Procedures</TabsTrigger>
      </TabsList>

      <TabsContent value="center" className="space-y-6">
        <OperationsHeader />
        <OperationsQuickActions />
        <OperationsToursOverview />
      </TabsContent>

      <TabsContent value="working">
        <OperationsDocumentsTab
          category="working_docs"
          title="Working Documents"
          description="Operational working documents organised by department."
        />
      </TabsContent>

      <TabsContent value="policies">
        <OperationsDocumentsTab
          category="policies"
          title="Policies and Procedures"
          description="Company policies and standard operating procedures by department."
        />
      </TabsContent>
    </Tabs>
  );
};
