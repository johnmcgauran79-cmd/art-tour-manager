
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TaskTemplatesManagement } from "@/components/TaskTemplatesManagement";
import { AllTasksView } from "@/components/AllTasksView";
import { useAuth } from "@/hooks/useAuth";
import { OperationsHeader } from "@/components/operations/OperationsHeader";
import { OperationsTasksCard } from "@/components/operations/OperationsTasksCard";
import { OperationsToursOverview } from "@/components/operations/OperationsToursOverview";

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
    <div className="space-y-6">
      <OperationsHeader />

      <OperationsTasksCard
        canManageTemplates={canManageTemplates}
        onManageTemplates={() => setCurrentView('templates')}
        onViewAllTasks={() => setCurrentView('allTasks')}
      />

      <OperationsToursOverview />
    </div>
  );
};
