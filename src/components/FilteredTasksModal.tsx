
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
            >
              Close
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
