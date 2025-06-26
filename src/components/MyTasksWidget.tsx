import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, Plus, List, ArrowLeft } from "lucide-react";
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
  onViewAllTasks?: () => void;
}

export const MyTasksWidget = ({ hideAddButton = false, limitToTop5 = false, onViewAllTasks }: MyTasksWidgetProps) => {
  const { data: tasks, isLoading } = useMyTasks();
  const [taskDetailModalOpen, setTaskDetailModalOpen] = useState(false);
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [filteredTasksModalOpen, setFilteredTasksModalOpen] = useState(false);
  const [allTasksModalOpen, setAllTasksModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [filteredTasksTitle, setFilteredTasksTitle] = useState("");
  const [activeFilter, setActiveFilter] = useState<'overdue' | 'critical' | 'high' | 'due_soon' | 'completed' | null>(null);
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

  // Calculate pending tasks
  const pendingTasks = useMemo(() => {
    return tasks?.filter(task => task.status !== 'completed' && task.status !== 'cancelled') || [];
  }, [tasks]);

  // Apply search filters to all tasks first
  const searchFilteredTasks = useMemo(() => {
    if (!tasks) return [];
    
    const hasFilters = Object.values(searchFilters).some(value => value !== undefined && value !== '');
    if (!hasFilters) return tasks;
    
    return tasks.filter(task => {
      if (searchFilters.search && !task.title.toLowerCase().includes(searchFilters.search.toLowerCase())) {
        return false;
      }
      
      if (searchFilters.tourName && (!task.tours?.name || !task.tours.name.toLowerCase().includes(searchFilters.tourName.toLowerCase()))) {
        return false;
      }
      
      if (searchFilters.status && task.status !== searchFilters.status) {
        return false;
      }
      
      if (searchFilters.priority && task.priority !== searchFilters.priority) {
        return false;
      }
      
      if (searchFilters.category && task.category !== searchFilters.category) {
        return false;
      }
      
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
  }, [tasks, searchFilters]);

  // Get filtered tasks based on active filter
  const currentFilteredTasks = useMemo(() => {
    if (!activeFilter) {
      const hasSearchFilters = Object.values(searchFilters).some(value => value !== undefined && value !== '');
      if (hasSearchFilters) {
        return searchFilteredTasks.filter(task => task.status !== 'completed' && task.status !== 'cancelled');
      }
      return pendingTasks;
    }

    switch (activeFilter) {
      case 'overdue':
        return searchFilteredTasks.filter(task => 
          task.status !== 'completed' && task.status !== 'cancelled' &&
          task.due_date && new Date(task.due_date) < new Date()
        );
      case 'critical':
        return searchFilteredTasks.filter(task => 
          task.status !== 'completed' && task.status !== 'cancelled' &&
          task.priority === 'critical'
        );
      case 'high':
        return searchFilteredTasks.filter(task => 
          task.status !== 'completed' && task.status !== 'cancelled' &&
          task.priority === 'high'
        );
      case 'due_soon':
        return searchFilteredTasks.filter(task => {
          if (task.status === 'completed' || task.status === 'cancelled' || !task.due_date) return false;
          const dueDate = new Date(task.due_date);
          const today = new Date();
          const sevenDaysFromNow = new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000));
          return dueDate >= today && dueDate <= sevenDaysFromNow;
        });
      case 'completed':
        return searchFilteredTasks.filter(task => task.status === 'completed' || task.status === 'cancelled');
      default:
        return searchFilteredTasks.filter(task => task.status !== 'completed' && task.status !== 'cancelled');
    }
  }, [activeFilter, pendingTasks, searchFilteredTasks, searchFilters]);

  // Sort and limit display tasks
  const displayTasks = useMemo(() => {
    const sortedTasks = [...currentFilteredTasks].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

    return limitToTop5 ? sortedTasks.slice(0, 5) : sortedTasks.slice(0, 10);
  }, [currentFilteredTasks, limitToTop5]);

  if (isLoading) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        Loading your tasks...
      </div>
    );
  }

  const handleCategoryClick = (type: 'overdue' | 'critical' | 'high' | 'due_soon' | 'completed') => {
    setActiveFilter(type);
  };

  const handleBackToAllTasks = () => {
    setActiveFilter(null);
  };

  const getFilterTitle = () => {
    switch (activeFilter) {
      case 'overdue':
        return "Overdue Tasks";
      case 'critical':
        return "Critical Priority Tasks";
      case 'high':
        return "High Priority Tasks";
      case 'due_soon':
        return "Due Soon (Next 7 Days)";
      case 'completed':
        return "Completed Tasks";
      default:
        return "My Tasks";
    }
  };

  const hasSearchFilters = Object.values(searchFilters).some(value => value !== undefined && value !== '');

  // If this is in the full widget mode (not limited), show everything consistently
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
                  {currentFilteredTasks.length} {hasSearchFilters ? 'filtered' : 'active'}
                </Badge>
                {activeFilter && (
                  <Badge variant="outline" className="text-xs">
                    {getFilterTitle()}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeFilter && (
                  <Button
                    onClick={handleBackToAllTasks}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Clear Filter
                  </Button>
                )}
                <Button
                  onClick={onViewAllTasks || (() => setAllTasksModalOpen(true))}
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
            
            {/* Always show categories grid */}
            <div className="mt-4">
              <TaskCategoriesGrid 
                tasks={pendingTasks}
                onCategoryClick={handleCategoryClick}
              />
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              {/* Always show search */}
              <TaskSearch onSearch={handleSearch} onClear={handleClearSearch} />

              {displayTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>
                    {activeFilter 
                      ? `No ${getFilterTitle().toLowerCase()} found`
                      : hasSearchFilters 
                        ? "No tasks found matching your search criteria" 
                        : "No active tasks assigned to you"
                    }
                  </p>
                  <p className="text-sm">
                    {!hasSearchFilters && !activeFilter && "Great job staying on top of everything!"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-gray-600 mb-3">
                    {activeFilter 
                      ? `Showing ${displayTasks.length} ${getFilterTitle().toLowerCase()}`
                      : `Showing ${hasSearchFilters ? 'filtered' : 'top 10 most urgent'} tasks`
                    }
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

        {!onViewAllTasks && (
          <AllTasksModal
            open={allTasksModalOpen}
            onOpenChange={setAllTasksModalOpen}
            onTaskClick={handleTaskClick}
          />
        )}
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
