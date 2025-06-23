
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, Plus, List } from "lucide-react";
import { useMyTasks, Task } from "@/hooks/useTasks";
import { TasksTable } from "@/components/TasksTable";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { AddTaskModal } from "@/components/AddTaskModal";
import { FilteredTasksModal } from "@/components/FilteredTasksModal";
import { AllTasksModal } from "@/components/AllTasksModal";
import { TaskCategoriesGrid } from "@/components/TaskCategoriesGrid";

interface MyTasksWidgetProps {
  hideAddButton?: boolean;
  limitToTop5?: boolean;
}

export const MyTasksWidget = ({ hideAddButton = false, limitToTop5 = false }: MyTasksWidgetProps) => {
  const { data: tasks, isLoading } = useMyTasks();
  const [taskDetailModalOpen, setTaskDetailModalOpen] = useState(false);
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [filteredTasksModalOpen, setFilteredTasksModalOpen] = useState(false);
  const [allTasksModalOpen, setAllTasksModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [filteredTasksTitle, setFilteredTasksTitle] = useState("");

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

  const handleFilteredTasksModalClose = (open: boolean) => {
    setFilteredTasksModalOpen(open);
    if (!open) {
      setFilteredTasks([]);
      setFilteredTasksTitle("");
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        Loading your tasks...
      </div>
    );
  };

  const pendingTasks = tasks?.filter(task => task.status !== 'completed' && task.status !== 'cancelled') || [];

  // Sort tasks by due date (most urgent first) and optionally limit to top 5
  const sortedTasks = [...pendingTasks].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  const displayTasks = limitToTop5 ? sortedTasks.slice(0, 5) : sortedTasks.slice(0, 10);

  const handleCategoryClick = (type: 'overdue' | 'critical' | 'high' | 'due_soon') => {
    let filtered: Task[] = [];
    let title = "";

    switch (type) {
      case 'overdue':
        filtered = pendingTasks.filter(task => 
          task.due_date && new Date(task.due_date) < new Date()
        );
        title = "Overdue Tasks";
        break;
      case 'critical':
        filtered = pendingTasks.filter(task => task.priority === 'critical');
        title = "Critical Priority Tasks";
        break;
      case 'high':
        filtered = pendingTasks.filter(task => task.priority === 'high');
        title = "High Priority Tasks";
        break;
      case 'due_soon':
        filtered = pendingTasks.filter(task => {
          if (!task.due_date) return false;
          const dueDate = new Date(task.due_date);
          const today = new Date();
          const sevenDaysFromNow = new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000));
          return dueDate >= today && dueDate <= sevenDaysFromNow;
        });
        title = "Due Soon (Next 7 Days)";
        break;
    }

    setFilteredTasks(filtered);
    setFilteredTasksTitle(title);
    setFilteredTasksModalOpen(true);
  };

  // If this is in the full widget mode (not limited), show categories and header
  if (!limitToTop5) {
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
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setAllTasksModalOpen(true)}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <List className="h-4 w-4" />
                  View All Tasks
                </Button>
                {!hideAddButton && (
                  <Button
                    onClick={() => setAddTaskModalOpen(true)}
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Task
                  </Button>
                )}
              </div>
            </div>
            
            <div className="mt-4">
              <TaskCategoriesGrid 
                tasks={pendingTasks}
                onCategoryClick={handleCategoryClick}
              />
            </div>
          </CardHeader>
          
          <CardContent>
            {displayTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No active tasks assigned to you</p>
                <p className="text-sm">Great job staying on top of everything!</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-gray-600 mb-3">
                  Showing top 10 most urgent tasks
                </div>
                <TasksTable
                  tasks={displayTasks}
                  loading={false}
                  showTourName={true}
                  onTaskClick={handleTaskClick}
                  title=""
                />
              </div>
            )}
          </CardContent>
        </Card>

        <TaskDetailModal
          task={selectedTask}
          open={taskDetailModalOpen}
          onOpenChange={handleTaskDetailModalClose}
        />

        {!hideAddButton && (
          <AddTaskModal
            open={addTaskModalOpen}
            onOpenChange={setAddTaskModalOpen}
          />
        )}

        <FilteredTasksModal
          open={filteredTasksModalOpen}
          onOpenChange={handleFilteredTasksModalClose}
          tasks={filteredTasks}
          title={filteredTasksTitle}
          onTaskClick={handleTaskClick}
        />

        <AllTasksModal
          open={allTasksModalOpen}
          onOpenChange={setAllTasksModalOpen}
          onTaskClick={handleTaskClick}
        />
      </>
    );
  }

  // Limited mode for Operations dashboard - just show the tasks without categories
  return (
    <div className="space-y-4">
      {displayTasks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No active tasks assigned to you</p>
          <p className="text-sm">Great job staying on top of everything!</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-gray-600 mb-3">
            Showing {displayTasks.length} most urgent tasks
          </div>
          <TasksTable
            tasks={displayTasks}
            loading={false}
            showTourName={true}
            onTaskClick={handleTaskClick}
            title=""
          />
        </div>
      )}

      <TaskDetailModal
        task={selectedTask}
        open={taskDetailModalOpen}
        onOpenChange={handleTaskDetailModalClose}
      />
    </div>
  );
};
