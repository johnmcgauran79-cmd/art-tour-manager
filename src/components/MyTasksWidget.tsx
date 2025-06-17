
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";
import { useMyTasks, Task } from "@/hooks/useTasks";
import { TasksTable } from "@/components/TasksTable";
import { TaskDetailModal } from "@/components/TaskDetailModal";

export const MyTasksWidget = () => {
  const { data: tasks, isLoading } = useMyTasks();
  const [taskDetailModalOpen, setTaskDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setTaskDetailModalOpen(true);
  };

  const handleTaskDetailModalClose = (open: boolean) => {
    setTaskDetailModalOpen(open);
    if (!open) {
      setSelectedTask(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-brand-navy/20 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-brand-navy">
            <ClipboardList className="h-5 w-5" />
            My Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Loading your tasks...
          </div>
        </CardContent>
      </Card>
    );
  }

  const pendingTasks = tasks?.filter(task => task.status !== 'completed' && task.status !== 'cancelled') || [];

  return (
    <>
      <Card className="border-brand-navy/20 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-brand-navy" />
              <CardTitle className="text-brand-navy">My Tasks</CardTitle>
              <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy">
                {pendingTasks.length} active
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {pendingTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No active tasks assigned to you</p>
              <p className="text-sm">Great job staying on top of everything!</p>
            </div>
          ) : (
            <TasksTable
              tasks={pendingTasks}
              loading={false}
              showTourName={true}
              onTaskClick={handleTaskClick}
              title=""
            />
          )}
        </CardContent>
      </Card>

      <TaskDetailModal
        task={selectedTask}
        open={taskDetailModalOpen}
        onOpenChange={handleTaskDetailModalClose}
      />
    </>
  );
};
