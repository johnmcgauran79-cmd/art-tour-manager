
import { StreamlinedTasksTable } from "@/components/StreamlinedTasksTable";
import { Task } from "@/hooks/useTasks";

interface TasksListProps {
  tasks: Task[];
  loading?: boolean;
  showTourName?: boolean;
  onCreateTask?: () => void;
  onTaskClick?: (task: Task) => void;
  title?: string;
}

export const TasksList = ({ 
  tasks, 
  loading = false, 
  showTourName = false, 
  onCreateTask, 
  onTaskClick,
  title = "Tasks" 
}: TasksListProps) => {
  return (
    <StreamlinedTasksTable
      tasks={tasks}
      loading={loading}
      onCreateTask={onCreateTask}
      onTaskClick={onTaskClick}
      title={title}
    />
  );
};
