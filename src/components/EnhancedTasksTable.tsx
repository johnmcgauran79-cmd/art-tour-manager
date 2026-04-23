import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Filter } from "lucide-react";
import { useTasks, Task } from "@/hooks/useTasks";
import { StreamlinedTasksTable } from "@/components/StreamlinedTasksTable";
import { AddTaskModal } from "@/components/AddTaskModal";
import { TaskFilters } from "@/components/TaskFilters";
import { BulkTaskOperationsPanel } from "@/components/BulkTaskOperationsPanel";
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
  const navigate = useNavigate();
  const [filters, setFilters] = useState<{
    search?: string;
    assigneeId?: string;
    status?: string;
    priority?: string;
    startDate?: string;
    endDate?: string;
    mentionsMe?: boolean;
  }>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);

  const { data: tasks, isLoading } = useTasks(tourId, filters);

  const handleTaskClick = (task: Task) => {
    navigate(`/tasks/${task.id}`);
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

  const handleClearSelection = () => {
    setSelectedTasks([]);
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
        </CardHeader>

        <CardContent className="space-y-4">
          <BulkTaskOperationsPanel
            selectedTasks={selectedTasks}
            tasks={tasks || []}
            onClearSelection={handleClearSelection}
          />

          <StreamlinedTasksTable
            tasks={tasks || []}
            loading={isLoading}
            onTaskClick={handleTaskClick}
            title=""
            selectedTasks={selectedTasks}
            onTaskSelection={handleTaskSelection}
            onSelectAll={handleSelectAll}
          />
        </CardContent>
      </Card>

      <AddTaskModal
        open={addTaskModalOpen}
        onOpenChange={setAddTaskModalOpen}
        tourId={tourId}
      />
    </>
  );
};
