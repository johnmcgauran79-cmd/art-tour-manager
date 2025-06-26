
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Plus } from "lucide-react";
import { useMyTasks, Task } from "@/hooks/useTasks";
import { TasksTable } from "@/components/TasksTable";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { AddTaskModal } from "@/components/AddTaskModal";
import { TaskCategoriesGrid } from "@/components/TaskCategoriesGrid";
import { TaskSearch } from "@/components/TaskSearch";

export const AllTasksView = () => {
  const { data: tasks, isLoading } = useMyTasks();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDetailModalOpen, setTaskDetailModalOpen] = useState(false);
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [filteredTasksTitle, setFilteredTasksTitle] = useState("");
  const [showFiltered, setShowFiltered] = useState(false);
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

  const handleCategoryClick = (type: 'overdue' | 'critical' | 'high' | 'due_soon') => {
    const pendingTasks = tasks?.filter(task => task.status !== 'completed' && task.status !== 'cancelled') || [];
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
    setShowFiltered(true);
  };

  const handleSearch = (filters: typeof searchFilters) => {
    setSearchFilters(filters);
    setShowFiltered(false);
  };

  const handleClearSearch = () => {
    setSearchFilters({});
    setShowFiltered(false);
  };

  // Filter tasks based on search criteria
  const displayTasks = useMemo(() => {
    if (!tasks) return [];
    
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
  }, [tasks, searchFilters]);

  const pendingTasks = tasks?.filter(task => task.status !== 'completed' && task.status !== 'cancelled') || [];

  if (isLoading) {
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

  if (showFiltered) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-brand-navy">{filteredTasksTitle}</h3>
            <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy">
              {filteredTasks.length} tasks
            </Badge>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFiltered(false)}
          >
            Back to All Tasks
          </Button>
        </div>
        
        <TasksTable
          tasks={filteredTasks}
          loading={false}
          showTourName={true}
          onTaskClick={handleTaskClick}
          title=""
        />
      </div>
    );
  }

  const hasSearchFilters = Object.values(searchFilters).some(value => value !== undefined && value !== '');

  return (
    <>
      <Card className="border-brand-navy/20 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-brand-navy" />
              <CardTitle className="text-brand-navy">All My Tasks</CardTitle>
              <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy">
                {hasSearchFilters ? displayTasks.length : tasks?.length || 0} {hasSearchFilters ? 'filtered' : 'total'}
              </Badge>
            </div>
            <Button
              onClick={() => setAddTaskModalOpen(true)}
              size="sm"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Task
            </Button>
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

            {/* Tasks Table */}
            {displayTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{hasSearchFilters ? "No tasks found matching your search criteria" : "No tasks found"}</p>
              </div>
            ) : (
              <TasksTable
                tasks={displayTasks}
                loading={false}
                showTourName={true}
                onTaskClick={handleTaskClick}
                title=""
              />
            )}
          </div>
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
      />
    </>
  );
};
