import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings2, ClipboardList } from "lucide-react";
import { useTasks, Task } from "@/hooks/useTasks";
import { StreamlinedTasksTable } from "@/components/StreamlinedTasksTable";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { AddTaskModal } from "@/components/AddTaskModal";
import { TaskTemplateModal } from "@/components/TaskTemplateModal";

interface TourTasksTabProps {
  tourId: string;
  tourName: string;
}

export const TourTasksTab = ({ tourId, tourName }: TourTasksTabProps) => {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDetailModalOpen, setTaskDetailModalOpen] = useState(false);
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [taskTemplateModalOpen, setTaskTemplateModalOpen] = useState(false);

  const { data: tasks, isLoading } = useTasks(tourId, {
    search: "",
    assigneeId: "",
    status: "",
    priority: "",
    startDate: "",
    endDate: ""
  });

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

  const activeTasks = tasks?.filter(task => 
    task.status !== 'completed' && task.status !== 'cancelled'
  ) || [];

  const completedTasks = tasks?.filter(task => 
    task.status === 'completed' || task.status === 'cancelled'
  ) || [];

  return (
    <>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-brand-navy/10 rounded-lg flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-brand-navy" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-brand-navy">Tasks for {tourName}</h3>
              <p className="text-sm text-muted-foreground">
                Manage and track all tasks related to this tour
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setTaskTemplateModalOpen(true)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Settings2 className="h-4 w-4" />
              Task Templates
            </Button>
            <Button
              onClick={() => setAddTaskModalOpen(true)}
              size="sm"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Task
            </Button>
          </div>
        </div>

        {/* Task Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-brand-navy/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Tasks</p>
                  <p className="text-2xl font-bold text-brand-navy">{tasks?.length || 0}</p>
                </div>
                <ClipboardList className="h-8 w-8 text-brand-navy/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-orange-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Tasks</p>
                  <p className="text-2xl font-bold text-orange-600">{activeTasks.length}</p>
                </div>
                <Badge variant="secondary" className="bg-orange-100 text-orange-600">
                  Active
                </Badge>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{completedTasks.length}</p>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-600">
                  Done
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tasks Table */}
        <Card className="border-brand-navy/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-brand-navy">All Tasks</CardTitle>
              <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy">
                {tasks?.length || 0} total
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-navy mx-auto"></div>
                <p className="text-muted-foreground mt-2">Loading tasks...</p>
              </div>
            ) : tasks && tasks.length > 0 ? (
              <StreamlinedTasksTable
                tasks={tasks}
                loading={isLoading}
                onTaskClick={handleTaskClick}
                title=""
              />
            ) : (
              <div className="text-center py-12">
                <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">No tasks yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first task for this tour to get started
                </p>
                <Button
                  onClick={() => setAddTaskModalOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add First Task
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <TaskDetailModal
        task={selectedTask}
        open={taskDetailModalOpen}
        onOpenChange={handleTaskDetailModalClose}
      />

      <AddTaskModal
        open={addTaskModalOpen}
        onOpenChange={setAddTaskModalOpen}
        tourId={tourId}
      />

      <TaskTemplateModal
        open={taskTemplateModalOpen}
        onOpenChange={setTaskTemplateModalOpen}
      />
    </>
  );
};