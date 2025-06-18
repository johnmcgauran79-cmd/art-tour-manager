
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle, CheckCircle, RefreshCw, Zap } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { useAutomatedTourTasks, useRegenerateTourTasks } from "@/hooks/useAutomatedTourTasks";
import { formatDistanceToNow } from "date-fns";

interface AutomatedTasksWidgetProps {
  tourId?: string;
  showHeader?: boolean;
}

export const AutomatedTasksWidget = ({ tourId, showHeader = true }: AutomatedTasksWidgetProps) => {
  const { data: tasks } = useTasks(tourId);
  const generateTasks = useAutomatedTourTasks();
  const regenerateTasks = useRegenerateTourTasks();

  // Filter for automated tasks
  const automatedTasks = tasks?.filter(task => task.is_automated) || [];
  const upcomingTasks = automatedTasks.filter(task => 
    task.due_date && 
    new Date(task.due_date) > new Date() && 
    task.status !== 'completed'
  );
  const overdueTasks = automatedTasks.filter(task => 
    task.due_date && 
    new Date(task.due_date) < new Date() && 
    task.status !== 'completed'
  );

  const handleGenerateTasks = () => {
    if (tourId) {
      generateTasks.mutate(tourId);
    }
  };

  const handleRegenerateTasks = () => {
    if (tourId) {
      regenerateTasks.mutate(tourId);
    }
  };

  if (!showHeader && automatedTasks.length === 0) {
    return null;
  }

  return (
    <Card className="border-purple-200">
      {showHeader && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-purple-800">Automated Tour Operations</CardTitle>
            </div>
            {tourId && (
              <div className="flex gap-2">
                <Button
                  onClick={handleGenerateTasks}
                  size="sm"
                  variant="outline"
                  disabled={generateTasks.isPending}
                  className="border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  <Zap className="h-4 w-4 mr-1" />
                  {generateTasks.isPending ? "Generating..." : "Generate Tasks"}
                </Button>
                <Button
                  onClick={handleRegenerateTasks}
                  size="sm"
                  variant="outline"
                  disabled={regenerateTasks.isPending}
                  className="border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  {regenerateTasks.isPending ? "Regenerating..." : "Regenerate"}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent>
        {automatedTasks.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No automated tasks generated yet</p>
            {tourId && (
              <Button
                onClick={handleGenerateTasks}
                size="sm"
                className="mt-2"
                disabled={generateTasks.isPending}
              >
                Generate Tour Tasks
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-lg font-bold text-purple-800">{automatedTasks.length}</div>
                <div className="text-xs text-purple-600">Total Tasks</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-lg font-bold text-orange-800">{upcomingTasks.length}</div>
                <div className="text-xs text-orange-600">Upcoming</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-lg font-bold text-red-800">{overdueTasks.length}</div>
                <div className="text-xs text-red-600">Overdue</div>
              </div>
            </div>

            {/* Overdue Tasks */}
            {overdueTasks.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  Overdue Tasks
                </h4>
                <div className="space-y-2">
                  {overdueTasks.slice(0, 3).map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-2 bg-red-50 rounded border-l-4 border-red-400">
                      <div>
                        <div className="font-medium text-sm text-red-800">{task.title}</div>
                        <div className="text-xs text-red-600">
                          Due {formatDistanceToNow(new Date(task.due_date!), { addSuffix: true })}
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 text-xs">
                        {task.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Tasks */}
            {upcomingTasks.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-blue-700 mb-2 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Upcoming Tasks
                </h4>
                <div className="space-y-2">
                  {upcomingTasks.slice(0, 3).map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-2 bg-blue-50 rounded border-l-4 border-blue-400">
                      <div>
                        <div className="font-medium text-sm text-blue-800">{task.title}</div>
                        <div className="text-xs text-blue-600">
                          Due {formatDistanceToNow(new Date(task.due_date!), { addSuffix: true })}
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                        {task.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-gray-500 bg-purple-50 p-2 rounded">
              💡 Tasks are automatically generated based on tour timeline and updated when tour dates change.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
