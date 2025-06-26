
import { AlertTriangle, Clock, Flag, CheckCircle } from "lucide-react";
import { TaskCategoryCard } from "./TaskCategoryCard";
import { Task } from "@/hooks/useTasks";

interface TaskCategoriesGridProps {
  tasks: Task[];
  onCategoryClick: (type: 'overdue' | 'critical' | 'high' | 'due_soon' | 'completed') => void;
}

export const TaskCategoriesGrid = ({ tasks, onCategoryClick }: TaskCategoriesGridProps) => {
  // Calculate task counts
  const overdueTasks = tasks.filter(task => 
    task.due_date && new Date(task.due_date) < new Date()
  );
  const criticalTasks = tasks.filter(task => task.priority === 'critical');
  const highPriorityTasks = tasks.filter(task => task.priority === 'high');
  const dueSoonTasks = tasks.filter(task => {
    if (!task.due_date) return false;
    const dueDate = new Date(task.due_date);
    const today = new Date();
    const sevenDaysFromNow = new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000));
    return dueDate >= today && dueDate <= sevenDaysFromNow;
  });

  // Get all tasks including completed ones for the completed count
  const allTasks = tasks; // This will be passed from parent with all tasks
  const completedTasks = allTasks.filter(task => task.status === 'completed' || task.status === 'cancelled');

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
