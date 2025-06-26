
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "lucide-react";

interface TaskCategoryCardProps {
  icon: LucideIcon;
  title: string;
  count: number;
  colorScheme: 'red' | 'purple' | 'orange' | 'yellow' | 'green';
  onClick: () => void;
}

const colorSchemes = {
  red: {
    border: 'border-red-200',
    hover: 'hover:bg-red-50 hover:border-red-300',
    iconBg: 'bg-red-100 group-hover:bg-red-200',
    iconColor: 'text-red-600',
    textHover: 'group-hover:text-red-700',
  },
  purple: {
    border: 'border-purple-200',
    hover: 'hover:bg-purple-50 hover:border-purple-300',
    iconBg: 'bg-purple-100 group-hover:bg-purple-200',
    iconColor: 'text-purple-600',
    textHover: 'group-hover:text-purple-700',
  },
  orange: {
    border: 'border-orange-200',
    hover: 'hover:bg-orange-50 hover:border-orange-300',
    iconBg: 'bg-orange-100 group-hover:bg-orange-200',
    iconColor: 'text-orange-600',
    textHover: 'group-hover:text-orange-700',
  },
  yellow: {
    border: 'border-yellow-200',
    hover: 'hover:bg-yellow-50 hover:border-yellow-300',
    iconBg: 'bg-yellow-100 group-hover:bg-yellow-200',
    iconColor: 'text-yellow-600',
    textHover: 'group-hover:text-yellow-700',
  },
  green: {
    border: 'border-green-200',
    hover: 'hover:bg-green-50 hover:border-green-300',
    iconBg: 'bg-green-100 group-hover:bg-green-200',
    iconColor: 'text-green-600',
    textHover: 'group-hover:text-green-700',
  },
};

export const TaskCategoryCard = ({ 
  icon: Icon, 
  title, 
  count, 
  colorScheme, 
  onClick 
}: TaskCategoryCardProps) => {
  const colors = colorSchemes[colorScheme];

  return (
    <div 
      className={`flex items-center gap-3 p-3 border-2 ${colors.border} rounded-lg cursor-pointer ${colors.hover} hover:shadow-md transition-all duration-200 group`}
      onClick={onClick}
    >
      <div className={`${colors.iconBg} p-2 rounded-full transition-colors flex-shrink-0`}>
        <Icon className={`h-4 w-4 ${colors.iconColor}`} />
      </div>
      <div className="flex flex-col">
        <p className={`font-semibold text-gray-800 ${colors.textHover} text-sm`}>{title}</p>
        <p className="text-xs text-gray-600">{count} tasks</p>
      </div>
    </div>
  );
};
