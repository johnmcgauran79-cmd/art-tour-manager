
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Users, Calendar, Settings, TrendingUp } from "lucide-react";

interface DashboardQuickActionsProps {
  onAddTour: () => void;
  onAddBooking: () => void;
  onAddContact: () => void;
  onAddTask: () => void;
  onViewAnalytics?: () => void;
}

export const DashboardQuickActions = ({
  onAddTour,
  onAddBooking,
  onAddContact,
  onAddTask,
  onViewAnalytics
}: DashboardQuickActionsProps) => {
  const quickActions = [
    {
      icon: Plus,
      label: "New Tour",
      onClick: onAddTour,
      color: "bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
    },
    {
      icon: Calendar,
      label: "New Booking",
      onClick: onAddBooking,
      color: "bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
    },
    {
      icon: Users,
      label: "Add Contact",
      onClick: onAddContact,
      color: "bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
    },
    {
      icon: Plus,
      label: "Add Task",
      onClick: onAddTask,
      color: "bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
    },
    ...(onViewAnalytics ? [{
      icon: TrendingUp,
      label: "Analytics",
      onClick: onViewAnalytics,
      color: "bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
    }] : [])
  ];

  return (
    <Card className="border-brand-navy/20 shadow-lg">
      <CardHeader>
        <CardTitle className="text-brand-navy flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`grid grid-cols-2 gap-4 ${onViewAnalytics ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
          {quickActions.map((action, index) => (
            <Button
              key={index}
              onClick={action.onClick}
              className={`${action.color} h-10 flex items-center justify-center space-x-2 hover:scale-105 transition-transform`}
            >
              <action.icon className="h-4 w-4" />
              <span className="text-sm font-medium">{action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
