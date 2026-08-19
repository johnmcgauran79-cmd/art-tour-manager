import { useState, useMemo } from "react";
import { useNavigationContext } from "@/hooks/useNavigationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings2, ClipboardList, Bell, ArrowLeft, Wrench } from "lucide-react";
import { useTasks, Task } from "@/hooks/useTasks";
import { StreamlinedTasksTable } from "@/components/tasks/StreamlinedTasksTable";
import { AddTaskModal } from "@/components/tasks/AddTaskModal";
import { TaskTemplateModal } from "@/components/tasks/TaskTemplateModal";
import { TaskNotificationsModal } from "@/components/tasks/TaskNotificationsModal";
import { CleanupAutomatedTasksModal } from "@/components/tasks/CleanupAutomatedTasksModal";
import { TaskCategoriesGrid } from "@/components/tasks/TaskCategoriesGrid";
import { TaskSearch } from "@/components/tasks/TaskSearch";
import { useAuth } from "@/hooks/useAuth";
import { isTaskFinished } from "@/lib/taskStatuses";

interface TourTasksTabProps {
  tourId: string;
  tourName: string;
}

export const TourTasksTab = ({ tourId, tourName }: TourTasksTabProps) => {
  const { navigateWithContext } = useNavigationContext();
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [taskTemplateModalOpen, setTaskTemplateModalOpen] = useState(false);
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [cleanupModalOpen, setCleanupModalOpen] = useState(false);
  const { userRole } = useAuth();

  // Agent users have view-only access
  const isAgent = userRole === 'agent';
  const isAdmin = userRole === 'admin';

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

  const { data: tasks, isLoading } = useTasks(tourId);

  const handleTaskClick = (task: Task) => {
    navigateWithContext(`/tasks/${task.id}`, {
      state: {
        tab: 'tasks',
        from: `/tours/${tourId}`,
      }
    });
  };

  const handleCategoryClick = (type: 'overdue' | 'critical' | 'high' | 'due_soon' | 'completed') => {
    setActiveFilter(type);
  };

  const handleBackToAllTasks = () => setActiveFilter(null);

  const handleSearch = (filters: typeof searchFilters) => {
    setSearchFilters(filters);
    setActiveFilter(null);
  };

  const handleClearSearch = () => {
    setSearchFilters({});
    setActiveFilter(null);
  };

  const allTasks = tasks || [];

  const automatedTasks = allTasks.filter(task => task.is_automated);
  const hasAutomatedTasks = automatedTasks.length > 0;
  const shouldShowCleanupButton = isAdmin && !isAgent;

  // Pending (non-finished) tasks
  const pendingTasks = useMemo(
    () => allTasks.filter(task => !isTaskFinished(task.status)),
    [allTasks]
  );

  // Apply search filters across all tasks
  const searchFilteredTasks = useMemo(() => {
    const hasFilters = Object.values(searchFilters).some(value => value !== undefined && value !== '');
    if (!hasFilters) return allTasks;

    return allTasks.filter(task => {
      if (searchFilters.search && !task.title.toLowerCase().includes(searchFilters.search.toLowerCase())) {
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
        if (new Date(task.due_date) < new Date(searchFilters.startDate)) return false;
      }
      if (searchFilters.endDate && task.due_date) {
        if (new Date(task.due_date) > new Date(searchFilters.endDate)) return false;
      }
      return true;
    });
  }, [allTasks, searchFilters]);

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
          !isTaskFinished(task.status) && task.priority === 'critical'
        );
      case 'high':
        return searchFilteredTasks.filter(task =>
          !isTaskFinished(task.status) && task.priority === 'high'
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

  const hasSearchFilters = Object.values(searchFilters).some(value => value !== undefined && value !== '');

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
            {!isAgent && (
              <>
                {shouldShowCleanupButton && (
                  <Button
                    onClick={() => setCleanupModalOpen(true)}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    <Wrench className="h-4 w-4" />
                    Sync Tasks
                  </Button>
                )}
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
                  onClick={() => setNotificationsModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Bell className="h-4 w-4" />
                  Task Reminders
                </Button>
                <Button
                  onClick={() => setAddTaskModalOpen(true)}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Task
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Action Items list */}
        <Card className="border-brand-navy/20 shadow-lg">
          <CardHeader className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <ClipboardList className="h-5 w-5 text-brand-navy flex-shrink-0" />
                <CardTitle className="text-brand-navy text-lg sm:text-xl">Action Items</CardTitle>
                <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy text-xs">
                  {currentFilteredTasks.length} {hasSearchFilters || activeFilter ? 'filtered' : 'active'}
                </Badge>
              </div>
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
            </div>

            {/* Categories grid */}
            <div className="mt-2">
              <TaskCategoriesGrid
                tasks={pendingTasks}
                onCategoryClick={handleCategoryClick}
              />
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-4">
              <TaskSearch onSearch={handleSearch} onClear={handleClearSearch} />

              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-navy mx-auto"></div>
                  <p className="text-muted-foreground mt-2">Loading tasks...</p>
                </div>
              ) : currentFilteredTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>
                    {activeFilter
                      ? "No tasks found for this filter"
                      : hasSearchFilters
                        ? "No tasks found matching your search criteria"
                        : "No active tasks found"}
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
      </div>

      {/* Modals */}
      <AddTaskModal
        open={addTaskModalOpen}
        onOpenChange={setAddTaskModalOpen}
        tourId={tourId}
      />

      <TaskTemplateModal
        open={taskTemplateModalOpen}
        onOpenChange={setTaskTemplateModalOpen}
      />
      <TaskNotificationsModal
        open={notificationsModalOpen}
        onOpenChange={setNotificationsModalOpen}
      />
      <CleanupAutomatedTasksModal
        tourId={tourId}
        tourName={tourName}
        open={cleanupModalOpen}
        onOpenChange={setCleanupModalOpen}
      />
    </>
  );
};
