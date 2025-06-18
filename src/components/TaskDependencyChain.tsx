
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { Task } from "@/hooks/useTasks";

interface TaskDependencyChainProps {
  task: Task;
  allTasks: Task[];
}

export const TaskDependencyChain = ({ task, allTasks }: TaskDependencyChainProps) => {
  const getDependencyChain = (currentTask: Task, visited = new Set<string>()): Task[] => {
    if (visited.has(currentTask.id)) return []; // Prevent circular dependencies
    visited.add(currentTask.id);

    const dependencies = [];
    if (currentTask.depends_on_task_id) {
      const dependentTask = allTasks.find(t => t.id === currentTask.depends_on_task_id);
      if (dependentTask) {
        dependencies.push(...getDependencyChain(dependentTask, visited));
        dependencies.push(dependentTask);
      }
    }
    return dependencies;
  };

  const getBlockedTasks = (currentTask: Task): Task[] => {
    return allTasks.filter(t => t.depends_on_task_id === currentTask.id);
  };

  const dependencyChain = getDependencyChain(task);
  const blockedTasks = getBlockedTasks(task);

  if (dependencyChain.length === 0 && blockedTasks.length === 0) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'waiting':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card className="border-orange-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Link className="h-4 w-4" />
          Task Dependencies
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {dependencyChain.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 text-orange-700">This task depends on:</h4>
            <div className="space-y-2">
              {dependencyChain.map((depTask, index) => (
                <div key={depTask.id} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400">{index + 1}.</span>
                  {getStatusIcon(depTask.status)}
                  <span className="font-medium">{depTask.title}</span>
                  <Badge variant="outline" className={`text-xs ${getStatusColor(depTask.status)}`}>
                    {depTask.status.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
            {dependencyChain.some(t => t.status !== 'completed') && (
              <p className="text-xs text-orange-600 mt-2">
                ⚠️ This task is blocked until all dependencies are completed
              </p>
            )}
          </div>
        )}

        {blockedTasks.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 text-blue-700">Tasks waiting for this one:</h4>
            <div className="space-y-2">
              {blockedTasks.map((blockedTask) => (
                <div key={blockedTask.id} className="flex items-center gap-2 text-sm">
                  {getStatusIcon(blockedTask.status)}
                  <span className="font-medium">{blockedTask.title}</span>
                  <Badge variant="outline" className={`text-xs ${getStatusColor(blockedTask.status)}`}>
                    {blockedTask.status.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
            {task.status !== 'completed' && (
              <p className="text-xs text-blue-600 mt-2">
                📋 {blockedTasks.length} task(s) will be unblocked when this is completed
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
