
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Task } from "@/hooks/useTasks";
import { TasksTable } from "@/components/TasksTable";

interface FilteredTasksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  title: string;
  onTaskClick: (task: Task) => void;
}

export const FilteredTasksModal = ({ 
  open, 
  onOpenChange, 
  tasks, 
  title, 
  onTaskClick 
}: FilteredTasksModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>{title}</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <TasksTable
            tasks={tasks}
            loading={false}
            title={title}
            showTourName={false}
            onTaskClick={onTaskClick}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
