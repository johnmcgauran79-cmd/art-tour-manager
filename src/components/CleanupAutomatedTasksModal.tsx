
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, RefreshCw, AlertTriangle } from "lucide-react";
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

  const handleCleanupAndRegenerate = async () => {
    setIsProcessing(true);
    try {
      // First regenerate tasks (this will archive old ones and create new ones)
      await regenerateTourTasks.mutateAsync(tourId);
      
      // Then cleanup the archived tasks
      await cleanupArchivedTasks.mutateAsync(tourId);
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error during cleanup and regeneration:', error);
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
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Cleanup Automated Tasks - {tourName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="font-medium text-orange-800">Task Cleanup Required</span>
            </div>
            <p className="text-sm text-orange-700">
              This tour has {totalDuplicates} duplicate automated tasks. This can happen when tour dates 
              are changed multiple times or tasks are regenerated repeatedly.
            </p>
          </div>

          {duplicateTaskGroups.length > 0 && (
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

          <div className="space-y-3">
            <h4 className="font-medium">Cleanup Options:</h4>
            
            <div className="space-y-2">
              <Button
                onClick={handleCleanupAndRegenerate}
                disabled={isProcessing}
                className="w-full flex items-center gap-2"
                variant="default"
              >
                <RefreshCw className="h-4 w-4" />
                {isProcessing ? "Processing..." : "Clean & Regenerate All Tasks"}
              </Button>
              <p className="text-xs text-gray-600">
                Archives all existing automated tasks and creates fresh ones based on current tour timeline.
              </p>
            </div>

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
                Permanently removes already archived automated tasks without affecting active ones.
              </p>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-700">
              <strong>Recommended:</strong> Use "Clean & Regenerate" to ensure all automated tasks 
              are correctly synchronized with your current tour dates and eliminate all duplicates.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
