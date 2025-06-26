
import { Check, AlertTriangle, Info, Calendar, Users, Bell } from "lucide-react";

interface NotificationIconProps {
  type: string;
  priority: string;
}

export const NotificationIcon = ({ type, priority }: NotificationIconProps) => {
  const className = `h-4 w-4 ${
    priority === 'critical' ? 'text-red-600' : 
    priority === 'high' ? 'text-orange-600' : 
    priority === 'medium' ? 'text-yellow-600' : 
    'text-blue-600'
  }`;

  switch (type) {
    case 'task': return <Check className={className} />;
    case 'tour': return <Calendar className={className} />;
    case 'booking': return <Users className={className} />;
    case 'system': return <Info className={className} />;
    default: return <Bell className={className} />;
  }
};
