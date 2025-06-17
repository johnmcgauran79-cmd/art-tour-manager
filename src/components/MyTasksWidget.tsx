
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, Plus, AlertTriangle, Clock, Flag } from "lucide-react";
import { useMyTasks, Task } from "@/hooks/useTasks";
import { TasksTable } from "@/components/TasksTable";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { AddTaskModal } from "@/components/AddTaskModal";
import { FilteredTasksModal } from "@/components/FilteredTasksModal";

export const MyTasksWidget = () => {
  const { data: tasks, isLoading } = useMyTasks();
  const [taskDetailModalOpen, setTaskDetailModalOpen] = useState(false);
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [filteredTasksModalOpen, setFilteredTasksModalOpen] = useState(false);
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
      <Card className="border-brand-navy/20 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-brand-navy">
            <ClipboardList className="h-5 w-5" />
            My Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Loading your tasks...
          </div>
        </CardContent>
      </Card>
    );
  }

  const pendingTasks = tasks?.filter(task => task.status !== 'completed' && task.status !== 'cancelled') || [];
  
  // Calculate task counts for headers
  const overdueTasks = pendingTasks.filter(task => 
    task.due_date && new Date(task.due_date) < new Date()
  );
  const criticalTasks = pendingTasks.filter(task => task.priority === 'critical');
  const highPriorityTasks = pendingTasks.filter(task => task.priority === 'high');
  const dueSoonTasks = pendingTasks.filter(task => {
    if (!task.due_date) return false;
    const dueDate = new Date(task.due_date);
    const today = new Date();
    const threeDaysFromNow = new Date(today.getTime() + (3 * 24 * 60 * 60 * 1000));
    return dueDate >= today && dueDate <= threeDaysFromNow;
  });

  // Sort tasks by due date and take top 10
  const sortedTasks = [...pendingTasks].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  }).slice(0, 10);

  const handleCategoryClick = (type: 'overdue' | 'critical' | 'high' | 'due_soon') => {
    let filtered: Task[] = [];
    let title = "";

    switch (type) {
      case 'overdue':
        filtered = overdueTasks;
        title = "Overdue Tasks";
        break;
      case 'critical':
        filtered = criticalTasks;
        title = "Critical Priority Tasks";
        break;
      case 'high':
        filtered = highPriorityTasks;
        title = "High Priority Tasks";
        break;
      case 'due_soon':
        filtered = dueSoonTasks;
        title = "Due Soon (Next 3 Days)";
        break;
    }

    setFilteredTasks(filtered);
    setFilteredTasksTitle(title);
    setFilteredTasksModalOpen(true);
  };

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
            <Button
              onClick={() => setAddTaskModalOpen(true)}
              size="sm"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Task
            </Button>
          </div>
          
          {/* Task Category Headers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div 
              className="text-center p-3 border-2 border-red-200 rounded-lg cursor-pointer hover:bg-red-50 hover:border-red-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleCategoryClick('overdue')}
            >
              <div className="bg-red-100 p-2 rounded-full mx-auto mb-2 w-fit group-hover:bg-red-200 transition-colors">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <p className="font-semibold text-gray-800 group-hover:text-red-700 text-xs">Overdue</p>
              <p className="text-xs text-gray-600">{overdueTasks.length} tasks</p>
            </div>
            
            <div 
              className="text-center p-3 border-2 border-purple-200 rounded-lg cursor-pointer hover:bg-purple-50 hover:border-purple-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleCategoryClick('critical')}
            >
              <div className="bg-purple-100 p-2 rounded-full mx-auto mb-2 w-fit group-hover:bg-purple-200 transition-colors">
                <Flag className="h-4 w-4 text-purple-600" />
              </div>
              <p className="font-semibold text-gray-800 group-hover:text-purple-700 text-xs">Critical</p>
              <p className="text-xs text-gray-600">{criticalTasks.length} tasks</p>
            </div>
            
            <div 
              className="text-center p-3 border-2 border-orange-200 rounded-lg cursor-pointer hover:bg-orange-50 hover:border-orange-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleCategoryClick('high')}
            >
              <div className="bg-orange-100 p-2 rounded-full mx-auto mb-2 w-fit group-hover:bg-orange-200 transition-colors">
                <Flag className="h-4 w-4 text-orange-600" />
              </div>
              <p className="font-semibold text-gray-800 group-hover:text-orange-700 text-xs">High Priority</p>
              <p className="text-xs text-gray-600">{highPriorityTasks.length} tasks</p>
            </div>
            
            <div 
              className="text-center p-3 border-2 border-yellow-200 rounded-lg cursor-pointer hover:bg-yellow-50 hover:border-yellow-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleCategoryClick('due_soon')}
            >
              <div className="bg-yellow-100 p-2 rounded-full mx-auto mb-2 w-fit group-hover:bg-yellow-200 transition-colors">
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
              <p className="font-semibold text-gray-800 group-hover:text-yellow-700 text-xs">Due Soon</p>
              <p className="text-xs text-gray-600">{dueSoonTasks.length} tasks</p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {sortedTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No active tasks assigned to you</p>
              <p className="text-sm">Great job staying on top of everything!</p>
            </div>
          ) : (
            <TasksTable
              tasks={sortedTasks}
              loading={false}
              showTourName={true}
              onTaskClick={handleTaskClick}
              title=""
            />
          )}
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

      <FilteredTasksModal
        open={filteredTasksModalOpen}
        onOpenChange={handleFilteredTasksModalClose}
        tasks={filteredTasks}
        title={filteredTasksTitle}
        onTaskClick={handleTaskClick}
      />
    </>
  );
};
