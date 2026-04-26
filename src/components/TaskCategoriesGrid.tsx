
import { AlertTriangle, Clock, Flag, CheckCircle } from "lucide-react";
import { TaskCategoryCard } from "./TaskCategoryCard";
import { Task } from "@/hooks/useTasks";
import { isTaskFinished } from "@/lib/taskStatuses";

interface TaskCategoriesGridProps {
  tasks: Task[];
  onCategoryClick: (type: 'overdue' | 'critical' | 'high' | 'due_soon' | 'completed') => void;
}

export const TaskCategoriesGrid = ({ tasks, onCategoryClick }: TaskCategoriesGridProps) => {
  console.log('TaskCategoriesGrid rendering with tasks:', tasks?.length);
  
  // Calculate task counts for non-completed tasks
  const pendingTasks = tasks.filter(task => !isTaskFinished(task.status));
  
  const overdueTasks = pendingTasks.filter(task => 
    task.due_date && new Date(task.due_date) < new Date()
  );
  const criticalTasks = pendingTasks.filter(task => task.priority === 'critical');
  const highPriorityTasks = pendingTasks.filter(task => task.priority === 'high');
  const dueSoonTasks = pendingTasks.filter(task => {
    if (!task.due_date) return false;
    const dueDate = new Date(task.due_date);
    const today = new Date();
    const sevenDaysFromNow = new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000));
    return dueDate >= today && dueDate <= sevenDaysFromNow;
  });

  // Get completed tasks count from all tasks
  const completedTasks = tasks.filter(task => isTaskFinished(task.status));

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <TaskCategoryCard
        icon={AlertTriangle}
        title="Overdue"
        count={overdueTasks.length}
        colorScheme="red"
        onClick={() => onCategoryClick('overdue')}
      />
      
      <TaskCategoryCard
        icon={Flag}
        title="Critical"
        count={criticalTasks.length}
        colorScheme="purple"
        onClick={() => onCategoryClick('critical')}
      />
      
      <TaskCategoryCard
        icon={Flag}
        title="High Priority"
        count={highPriorityTasks.length}
        colorScheme="orange"
        onClick={() => onCategoryClick('high')}
      />
      
      <TaskCategoryCard
        icon={Clock}
        title="Due Soon"
        count={dueSoonTasks.length}
        colorScheme="yellow"
        onClick={() => onCategoryClick('due_soon')}
      />

      <TaskCategoryCard
        icon={CheckCircle}
        title="Completed"
        count={completedTasks.length}
        colorScheme="green"
        onClick={() => onCategoryClick('completed')}
      />
    </div>
  );
};
