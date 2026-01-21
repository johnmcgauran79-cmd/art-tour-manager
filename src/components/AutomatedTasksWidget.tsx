
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";

interface AutomatedTasksWidgetProps {
  tourId: string;
}

export const AutomatedTasksWidget = ({ tourId }: AutomatedTasksWidgetProps) => {
  const { data: tasks } = useTasks(tourId);

  const automatedTasks = tasks?.filter(task => task.is_automated) || [];
  const completedAutomatedTasks = automatedTasks.filter(task => task.status === 'completed');
  const pendingAutomatedTasks = automatedTasks.filter(task => 
    task.status !== 'completed' && task.status !== 'cancelled' && task.status !== 'archived'
  );
  const overdueAutomatedTasks = pendingAutomatedTasks.filter(task => 
    task.due_date && new Date(task.due_date) < new Date()
  );

  if (automatedTasks.length === 0) {
    return null;
  }

  return (
    <Card className="border-purple-200 bg-purple-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-purple-800 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Automated Tour Tasks
          </CardTitle>
          <Badge variant="secondary" className="bg-purple-100 text-purple-700">
            Fully Automated
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-white border border-green-200 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <p className="font-semibold text-green-700 text-sm">Completed</p>
            <p className="text-lg font-bold text-green-800">{completedAutomatedTasks.length}</p>
          </div>
          
          <div className="text-center p-3 bg-white border border-blue-200 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <p className="font-semibold text-blue-700 text-sm">Pending</p>
            <p className="text-lg font-bold text-blue-800">{pendingAutomatedTasks.length}</p>
          </div>
          
          <div className="text-center p-3 bg-white border border-red-200 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <p className="font-semibold text-red-700 text-sm">Overdue</p>
            <p className="text-lg font-bold text-red-800">{overdueAutomatedTasks.length}</p>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-purple-100 border border-purple-200 rounded-lg">
          <p className="text-xs text-purple-700">
            <strong>Intelligent Automation:</strong> Task due dates automatically update when you change any related dates - 
            tour dates or hotel cutoff dates. The system maintains perfect synchronization without any manual intervention.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
