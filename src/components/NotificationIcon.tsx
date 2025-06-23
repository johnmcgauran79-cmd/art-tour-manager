
import { Bell, Settings, Calendar, FileText, Info } from "lucide-react";

interface NotificationIconProps {
  type: string;
  priority: string;
}

export const NotificationIcon = ({ type, priority }: NotificationIconProps) => {
  const className = `h-3 w-3 ${
    priority === 'critical' ? 'text-red-600' : 
    priority === 'high' ? 'text-orange-600' : 
    priority === 'medium' ? 'text-yellow-600' : 
    'text-blue-600'
  }`;

  switch (type) {
    case 'task': return <Settings className={className} />;
    case 'tour': return <Calendar className={className} />;
    case 'booking': return <FileText className={className} />;
    case 'system': return <Info className={className} />;
    default: return <Bell className={className} />;
  }
};
