
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Filter } from "lucide-react";
import { useTasks, Task } from "@/hooks/useTasks";
import { TasksTable } from "@/components/TasksTable";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { AddTaskModal } from "@/components/AddTaskModal";
import { TaskFilters } from "@/components/TaskFilters";
import { BulkTaskOperations } from "@/components/BulkTaskOperations";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface EnhancedTasksTableProps {
  tourId?: string;
  title?: string;
  showCreateButton?: boolean;
}

export const EnhancedTasksTable = ({
  tourId,
  title = "Tasks",
  showCreateButton = true,
}: EnhancedTasksTableProps) => {
  const [filters, setFilters] = useState<{
    search?: string;
    assigneeId?: string;
    status?: string;
    priority?: string;
    startDate?: string;
    endDate?: string;
  }>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [taskDetailModalOpen, setTaskDetailModalOpen] = useState(false);
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const { data: tasks, isLoading } = useTasks(tourId, filters);

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

  const handleFiltersChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  const handleTaskSelection = (taskId: string, selected: boolean) => {
    if (selected) {
      setSelectedTasks(prev => [...prev, taskId]);
    } else {
      setSelectedTasks(prev => prev.filter(id => id !== taskId));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedTasks(tasks?.map(task => task.id) || []);
    } else {
      setSelectedTasks([]);
    }
  };

  return (
    <>
      <Card className="border-brand-navy/20 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-brand-navy">{title}</CardTitle>
            <div className="flex items-center gap-2">
              <Collapsible open={showFilters} onOpenChange={setShowFilters}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filters
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
              {showCreateButton && (
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

          <Collapsible open={showFilters} onOpenChange={setShowFilters}>
            <CollapsibleContent className="space-y-4">
              <TaskFilters
                onFiltersChange={handleFiltersChange}
                onClearFilters={handleClearFilters}
              />
            </CollapsibleContent>
          </Collapsible>

          <BulkTaskOperations
            tasks={tasks || []}
            selectedTasks={selectedTasks}
            onTaskSelection={handleTaskSelection}
            onSelectAll={handleSelectAll}
          />
        </CardHeader>

        <CardContent>
          <TasksTable
            tasks={tasks || []}
            loading={isLoading}
            showTourName={!tourId}
            onTaskClick={handleTaskClick}
            title=""
            selectedTasks={selectedTasks}
            onTaskSelection={handleTaskSelection}
          />
        </CardContent>
      </Card>

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
    </>
  );
};
