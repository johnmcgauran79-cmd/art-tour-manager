
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, RefreshCw, AlertTriangle, Zap } from "lucide-react";
import { useCleanupArchivedTasks, useRegenerateTourTasks } from "@/hooks/useAutomatedTourTasks";
import { useTasks } from "@/hooks/useTasks";

interface CleanupAutomatedTasksModalProps {
  tourId: string;
  tourName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CleanupAutomatedTasksModal = ({ 
  tourId, 
  tourName, 
  open, 
  onOpenChange 
}: CleanupAutomatedTasksModalProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { data: tasks } = useTasks(tourId);
  const cleanupArchivedTasks = useCleanupArchivedTasks();
  const regenerateTourTasks = useRegenerateTourTasks();

  const automatedTasks = tasks?.filter(task => task.is_automated) || [];
  const duplicateGroups = automatedTasks.reduce((acc, task) => {
    const key = task.title;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(task);
    return acc;
  }, {} as Record<string, typeof automatedTasks>);

  const duplicateTaskGroups = Object.entries(duplicateGroups).filter(([_, tasks]) => tasks.length > 1);
  const totalDuplicates = duplicateTaskGroups.reduce((sum, [_, tasks]) => sum + tasks.length - 1, 0);
  const archivedTasks = automatedTasks.filter(task => task.status === 'archived');
  const hasAutomatedTasks = automatedTasks.length > 0;

  const handleSyncTasks = async () => {
    setIsProcessing(true);
    try {
      // Use the improved regenerate function that deletes old tasks first
      await regenerateTourTasks.mutateAsync(tourId);
      onOpenChange(false);
    } catch (error) {
      console.error('Error during task synchronization:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCleanupArchivedOnly = async () => {
    setIsProcessing(true);
    try {
      await cleanupArchivedTasks.mutateAsync(tourId);
      onOpenChange(false);
    } catch (error) {
      console.error('Error during cleanup:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            Sync Automated Tasks - {tourName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!hasAutomatedTasks ? (
            // No automated tasks scenario
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">Generate Automated Tasks</span>
              </div>
              <p className="text-sm text-blue-700">
                This tour doesn't have any automated tasks yet. Generate the standard set of operation tasks 
                like "Final Payment Reminder", "Hotel Booking Confirmation", "Travel Document Check", etc. 
                based on your tour timeline.
              </p>
            </div>
          ) : (
            // Has automated tasks scenario
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span className="font-medium text-orange-800">Task Synchronization Available</span>
              </div>
              <p className="text-sm text-orange-700">
                This tour has {automatedTasks.length} automated tasks
                {totalDuplicates > 0 && ` with ${totalDuplicates} duplicates`}
                {archivedTasks.length > 0 && ` and ${archivedTasks.length} archived tasks`}. 
                Sync to ensure all tasks are current with your tour dates.
              </p>
            </div>
          )}

          {hasAutomatedTasks && duplicateTaskGroups.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Duplicate Task Groups:</h4>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {duplicateTaskGroups.map(([title, tasks]) => (
                  <div key={title} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">{title}</span>
                    <Badge variant="destructive">{tasks.length} copies</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasAutomatedTasks && archivedTasks.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Archived Tasks:</h4>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {archivedTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">{task.title}</span>
                    <Badge variant="secondary">Archived</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="font-medium">Synchronization Options:</h4>
            
            <div className="space-y-2">
              <Button
                onClick={handleSyncTasks}
                disabled={isProcessing}
                className="w-full flex items-center gap-2"
                variant="default"
              >
                <RefreshCw className="h-4 w-4" />
                {isProcessing ? "Processing..." : hasAutomatedTasks ? "Sync & Regenerate All Tasks" : "Generate Automated Tasks"}
              </Button>
              <p className="text-xs text-gray-600">
                {hasAutomatedTasks 
                  ? "Removes all existing automated tasks (except completed ones) and creates fresh ones based on current tour timeline."
                  : "Creates the standard set of automated operation tasks based on your tour dates and timeline."
                }
              </p>
            </div>

            {hasAutomatedTasks && archivedTasks.length > 0 && (
              <div className="space-y-2">
                <Button
                  onClick={handleCleanupArchivedOnly}
                  disabled={isProcessing}
                  className="w-full flex items-center gap-2"
                  variant="outline"
                >
                  <Trash2 className="h-4 w-4" />
                  {isProcessing ? "Processing..." : "Clean Archived Tasks Only"}
                </Button>
                <p className="text-xs text-gray-600">
                  Permanently removes only the archived automated tasks without affecting active ones.
                </p>
              </div>
            )}
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-700">
              <strong>Recommended:</strong> Use the sync function to ensure all automated tasks 
              are correctly aligned with your current tour dates. This eliminates duplicates and ensures 
              proper task scheduling for your operations team.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
