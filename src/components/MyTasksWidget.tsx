
import { useState, useMemo } from "react";
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
import { TaskSearch } from "@/components/TaskSearch";

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
  const [searchFilters, setSearchFilters] = useState<{
    search?: string;
    status?: string;
    priority?: string;
    category?: string;
    assigneeId?: string;
    startDate?: string;
    endDate?: string;
    tourName?: string;
  }>({});

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

  const handleSearch = (filters: typeof searchFilters) => {
    setSearchFilters(filters);
  };

  const handleClearSearch = () => {
    setSearchFilters({});
  };

  // Always calculate pending tasks
  const pendingTasks = useMemo(() => {
    return tasks?.filter(task => task.status !== 'completed' && task.status !== 'cancelled') || [];
  }, [tasks]);

  // Filter tasks based on search criteria - always calculate this
  const filteredTasksData = useMemo(() => {
    if (!tasks) return [];
    
    const hasFilters = Object.values(searchFilters).some(value => value !== undefined && value !== '');
    if (!hasFilters) return pendingTasks;
    
    return tasks.filter(task => {
      // Text search in task title
      if (searchFilters.search && !task.title.toLowerCase().includes(searchFilters.search.toLowerCase())) {
        return false;
      }
      
      // Tour name search
      if (searchFilters.tourName && (!task.tours?.name || !task.tours.name.toLowerCase().includes(searchFilters.tourName.toLowerCase()))) {
        return false;
      }
      
      // Status filter
      if (searchFilters.status && task.status !== searchFilters.status) {
        return false;
      }
      
      // Priority filter
      if (searchFilters.priority && task.priority !== searchFilters.priority) {
        return false;
      }
      
      // Category filter
      if (searchFilters.category && task.category !== searchFilters.category) {
        return false;
      }
      
      // Date range filter
      if (searchFilters.startDate && task.due_date) {
        const taskDate = new Date(task.due_date);
        const startDate = new Date(searchFilters.startDate);
        if (taskDate < startDate) return false;
      }
      
      if (searchFilters.endDate && task.due_date) {
        const taskDate = new Date(task.due_date);
        const endDate = new Date(searchFilters.endDate);
        if (taskDate > endDate) return false;
      }
      
      return true;
    });
  }, [tasks, searchFilters, pendingTasks]);

  // Sort tasks by due date and limit - always calculate this
  const displayTasks = useMemo(() => {
    const sortedTasks = [...filteredTasksData].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

    return limitToTop5 ? sortedTasks.slice(0, 5) : sortedTasks.slice(0, 10);
  }, [filteredTasksData, limitToTop5]);

  if (isLoading) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        Loading your tasks...
      </div>
    );
  }

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

  const hasSearchFilters = Object.values(searchFilters).some(value => value !== undefined && value !== '');

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
                  {hasSearchFilters ? filteredTasksData.length : pendingTasks.length} {hasSearchFilters ? 'filtered' : 'active'}
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
            
            {!hasSearchFilters && (
              <div className="mt-4">
                <TaskCategoriesGrid 
                  tasks={pendingTasks}
                  onCategoryClick={handleCategoryClick}
                />
              </div>
            )}
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              {/* Enhanced Search */}
              <TaskSearch onSearch={handleSearch} onClear={handleClearSearch} />

              {displayTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{hasSearchFilters ? "No tasks found matching your search criteria" : "No active tasks assigned to you"}</p>
                  <p className="text-sm">{!hasSearchFilters && "Great job staying on top of everything!"}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-gray-600 mb-3">
                    Showing {hasSearchFilters ? 'filtered' : 'top 10 most urgent'} tasks
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
            </div>
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
