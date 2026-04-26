import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ClipboardList, Plus, ArrowLeft, UserCheck, PenSquare, Globe } from "lucide-react";
import { useMyTasks, Task } from "@/hooks/useTasks";
import { StreamlinedTasksTable } from "@/components/StreamlinedTasksTable";
import { AddTaskModal } from "@/components/AddTaskModal";
import { TaskCategoriesGrid } from "@/components/TaskCategoriesGrid";
import { TaskSearch } from "@/components/TaskSearch";
import { useAuth } from "@/hooks/useAuth";
import { isTaskFinished } from "@/lib/taskStatuses";

export const AllTasksView = () => {
  console.log('AllTasksView rendering');
  
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';

  // Default view = assigned-to-me only. Other toggles are additive.
  const [assignedToMe, setAssignedToMe] = useState(true);
  const [createdByMe, setCreatedByMe] = useState(false);
  const [allTasks, setAllTasks] = useState(false);

  const { data: tasks, isLoading } = useMyTasks({
    assignedToMe,
    createdByMe,
    allTasks: isAdmin && allTasks,
  });
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
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

  console.log('AllTasksView state:', { 
    tasksCount: tasks?.length, 
    isLoading, 
    activeFilter 
  });

  const handleTaskClick = (task: Task) => {
    navigate(`/tasks/${task.id}`);
  };

  const handleCategoryClick = (type: 'overdue' | 'critical' | 'high' | 'due_soon' | 'completed') => {
    console.log('Category clicked:', type);
    setActiveFilter(type);
  };

  const handleBackToAllTasks = () => {
    console.log('Back to all tasks clicked, clearing activeFilter');
    setActiveFilter(null);
  };

  const handleSearch = (filters: typeof searchFilters) => {
    setSearchFilters(filters);
    setActiveFilter(null); // Clear active filter when searching
  };

  const handleClearSearch = () => {
    setSearchFilters({});
    setActiveFilter(null);
  };

  // Calculate pending tasks
  const pendingTasks = useMemo(() => {
    return tasks?.filter(task => !isTaskFinished(task.status)) || [];
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
        return searchFilteredTasks.filter(task => !isTaskFinished(task.status));
      }
      return pendingTasks;
    }

    switch (activeFilter) {
      case 'overdue':
        return searchFilteredTasks.filter(task => 
          !isTaskFinished(task.status) &&
          task.due_date && new Date(task.due_date) < new Date()
        );
      case 'critical':
        return searchFilteredTasks.filter(task => 
          !isTaskFinished(task.status) &&
          task.priority === 'critical'
        );
      case 'high':
        return searchFilteredTasks.filter(task => 
          !isTaskFinished(task.status) &&
          task.priority === 'high'
        );
      case 'due_soon':
        return searchFilteredTasks.filter(task => {
          if (isTaskFinished(task.status) || !task.due_date) return false;
          const dueDate = new Date(task.due_date);
          const today = new Date();
          const sevenDaysFromNow = new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000));
          return dueDate >= today && dueDate <= sevenDaysFromNow;
        });
      case 'completed':
        return searchFilteredTasks.filter(task => isTaskFinished(task.status));
      default:
        return searchFilteredTasks.filter(task => !isTaskFinished(task.status));
    }
  }, [activeFilter, pendingTasks, searchFilteredTasks, searchFilters]);

  const getFilterTitle = () => {
    return "Action Items";
  };

  if (isLoading) {
    console.log('AllTasksView showing loading state');
    return (
      <Card className="border-brand-navy/20 shadow-lg">
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading your tasks...
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasSearchFilters = Object.values(searchFilters).some(value => value !== undefined && value !== '');

  console.log('AllTasksView rendering main view');
  
  return (
    <>
      <Card className="border-brand-navy/20 shadow-lg">
        <CardHeader className="space-y-4">
          {/* Title and buttons - stacks on mobile */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <ClipboardList className="h-5 w-5 text-brand-navy flex-shrink-0" />
              <CardTitle className="text-brand-navy text-lg sm:text-xl">
                {getFilterTitle()}
              </CardTitle>
              <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy text-xs">
                {currentFilteredTasks.length} {hasSearchFilters || activeFilter ? 'filtered' : 'active'}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeFilter && (
                <Button
                  onClick={handleBackToAllTasks}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-1"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Clear Filter</span>
                  <span className="sm:hidden">Clear</span>
                </Button>
              )}
              <Button
                onClick={() => setAddTaskModalOpen(true)}
                size="sm"
                className="flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Task</span>
              </Button>
            </div>
          </div>
          
          {/* Categories grid */}
          <div className="mt-2">
            <TaskCategoriesGrid 
              tasks={pendingTasks}
              onCategoryClick={handleCategoryClick}
            />
          </div>

          {/* Scope filters: choose which tasks to include in the list */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
            <span className="text-xs font-medium text-muted-foreground mr-1">Show:</span>
            <label
              htmlFor="filter-assigned-to-me"
              className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                id="filter-assigned-to-me"
                checked={assignedToMe}
                onCheckedChange={(checked) => setAssignedToMe(checked as boolean)}
              />
              <UserCheck className="h-3.5 w-3.5 text-brand-navy" />
              <span>Assigned to me</span>
            </label>
            <label
              htmlFor="filter-created-by-me"
              className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                id="filter-created-by-me"
                checked={createdByMe}
                onCheckedChange={(checked) => setCreatedByMe(checked as boolean)}
              />
              <PenSquare className="h-3.5 w-3.5 text-brand-navy" />
              <span>Created by me</span>
            </label>
            {isAdmin && (
              <label
                htmlFor="filter-all-tasks"
                className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  id="filter-all-tasks"
                  checked={allTasks}
                  onCheckedChange={(checked) => setAllTasks(checked as boolean)}
                />
                <Globe className="h-3.5 w-3.5 text-brand-navy" />
                <span>All tasks (admin)</span>
              </label>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            <TaskSearch onSearch={handleSearch} onClear={handleClearSearch} />

            {currentFilteredTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>
                  {activeFilter 
                    ? `No ${getFilterTitle().toLowerCase()} found`
                    : hasSearchFilters 
                      ? "No tasks found matching your search criteria" 
                      : "No active tasks found"
                  }
                </p>
              </div>
            ) : (
              <StreamlinedTasksTable
                tasks={currentFilteredTasks}
                loading={false}
                onTaskClick={handleTaskClick}
                title=""
              />
            )}
          </div>
        </CardContent>
      </Card>

      <AddTaskModal
        open={addTaskModalOpen}
        onOpenChange={setAddTaskModalOpen}
      />
    </>
  );
};
