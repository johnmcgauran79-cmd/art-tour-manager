
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, List, Plus } from "lucide-react";
import { MyTasksWidget } from "@/components/MyTasksWidget";

interface OperationsTasksCardProps {
  canManageTemplates: boolean;
  onManageTemplates: () => void;
  onViewAllTasks: () => void;
}

export const OperationsTasksCard = ({ 
  canManageTemplates, 
  onManageTemplates, 
  onViewAllTasks 
}: OperationsTasksCardProps) => {
  return (
    <Card className="border-brand-navy/20 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-brand-navy" />
            <CardTitle className="text-brand-navy">My Priority Tasks</CardTitle>
            <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy">
              Top 5 Most Urgent
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {canManageTemplates && (
              <Button
                onClick={onManageTemplates}
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Manage Templates
              </Button>
            )}
            <Button
              onClick={onViewAllTasks}
              size="sm"
              variant="outline"
              className="flex items-center gap-2"
            >
              <List className="h-4 w-4" />
              View All Tasks
            </Button>
            <Button
              size="sm"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Task
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <MyTasksWidget hideAddButton={true} limitToTop5={true} />
      </CardContent>
    </Card>
  );
};
