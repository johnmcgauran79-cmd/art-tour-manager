
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Users, Calendar } from "lucide-react";

interface DashboardQuickActionsProps {
  onAddTour: () => void;
  onAddBooking: () => void;
  onAddContact: () => void;
  onAddTask: () => void;
}

export const DashboardQuickActions = ({
  onAddTour,
  onAddBooking,
  onAddContact,
  onAddTask
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
    }
  ];

  return (
    <Card className="border-brand-navy/20 shadow-lg">
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
