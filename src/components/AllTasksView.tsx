
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Search, Plus } from "lucide-react";
import { useMyTasks, Task } from "@/hooks/useTasks";
import { TasksTable } from "@/components/TasksTable";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { AddTaskModal } from "@/components/AddTaskModal";
import { TaskCategoriesGrid } from "@/components/TaskCategoriesGrid";

export const AllTasksView = () => {
  const { data: tasks, isLoading } = useMyTasks();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDetailModalOpen, setTaskDetailModalOpen] = useState(false);
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [filteredTasksTitle, setFilteredTasksTitle] = useState("");
  const [showFiltered, setShowFiltered] = useState(false);

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

  // Filter tasks based on search term
  const displayTasks = tasks?.filter(task => {
    if (!searchTerm.trim()) return true;
    const searchLower = searchTerm.toLowerCase();
    return task.title.toLowerCase().includes(searchLower) ||
           (task.tours?.name?.toLowerCase().includes(searchLower));
  }) || [];

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

  return (
    <>
      <Card className="border-brand-navy/20 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-brand-navy" />
              <CardTitle className="text-brand-navy">All My Tasks</CardTitle>
              <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy">
                {tasks?.length || 0} total
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
          
          <div className="mt-4">
            <TaskCategoriesGrid 
              tasks={pendingTasks}
              onCategoryClick={handleCategoryClick}
            />
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by task title or tour name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Tasks Table */}
            {displayTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{searchTerm ? `No tasks found matching "${searchTerm}"` : "No tasks found"}</p>
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
