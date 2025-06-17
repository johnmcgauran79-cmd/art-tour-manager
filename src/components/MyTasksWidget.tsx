
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, AlertTriangle, Clock } from "lucide-react";
import { useMyTasks } from "@/hooks/useTasks";
import { TaskCard } from "@/components/TaskCard";

export const MyTasksWidget = () => {
  const { data: tasks, isLoading } = useMyTasks();

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
  const overdueTasks = pendingTasks.filter(task => 
    task.due_date && new Date(task.due_date) < new Date()
  );
  const highPriorityTasks = pendingTasks.filter(task => 
    task.priority === 'critical' || task.priority === 'high'
  );

  return (
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
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 border border-gray-200 rounded-lg">
            <div className="text-lg font-semibold text-gray-900">{pendingTasks.length}</div>
            <div className="text-xs text-gray-600">Active</div>
          </div>
          <div className="text-center p-2 border border-orange-200 rounded-lg">
            <div className="text-lg font-semibold text-orange-700">{highPriorityTasks.length}</div>
            <div className="text-xs text-orange-600">High Priority</div>
          </div>
          <div className="text-center p-2 border border-red-200 rounded-lg">
            <div className="text-lg font-semibold text-red-700">{overdueTasks.length}</div>
            <div className="text-xs text-red-600">Overdue</div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {pendingTasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No active tasks assigned to you</p>
            <p className="text-sm">Great job staying on top of everything!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Show overdue tasks first */}
            {overdueTasks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">Overdue Tasks</span>
                </div>
                {overdueTasks.slice(0, 2).map((task) => (
                  <TaskCard key={task.id} task={task} showTourName={true} />
                ))}
              </div>
            )}
            
            {/* Show high priority tasks */}
            {highPriorityTasks.filter(task => !overdueTasks.includes(task)).length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-orange-600 font-medium">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">High Priority</span>
                </div>
                {highPriorityTasks
                  .filter(task => !overdueTasks.includes(task))
                  .slice(0, 2)
                  .map((task) => (
                    <TaskCard key={task.id} task={task} showTourName={true} />
                  ))}
              </div>
            )}
            
            {/* Show recent tasks if not many high priority/overdue */}
            {pendingTasks.length > (overdueTasks.length + highPriorityTasks.length) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600 font-medium">
                  <ClipboardList className="h-4 w-4" />
                  <span className="text-sm">Recent Tasks</span>
                </div>
                {pendingTasks
                  .filter(task => !overdueTasks.includes(task) && !highPriorityTasks.includes(task))
                  .slice(0, 3)
                  .map((task) => (
                    <TaskCard key={task.id} task={task} showTourName={true} />
                  ))}
              </div>
            )}
            
            {pendingTasks.length > 5 && (
              <div className="text-center pt-2">
                <p className="text-sm text-gray-500">
                  +{pendingTasks.length - 5} more tasks
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
