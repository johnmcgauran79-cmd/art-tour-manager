import { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  status: string
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive'
  icon?: LucideIcon
  className?: string
}

const statusVariants = {
  default: "bg-muted text-muted-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground", 
  destructive: "bg-destructive text-destructive-foreground",
}

export function StatusBadge({ 
  status, 
  variant = 'default', 
  icon: Icon,
  className 
}: StatusBadgeProps) {
  return (
    <Badge 
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium capitalize",
        statusVariants[variant],
        className
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {status.replace('_', ' ')}
    </Badge>
  )
}

// Predefined status mappings for consistency
export const tourStatusConfig = {
  pending: { variant: 'warning' as const, icon: null },
  available: { variant: 'success' as const, icon: null },
  closed: { variant: 'secondary' as const, icon: null },
  sold_out: { variant: 'destructive' as const, icon: null },
  past: { variant: 'default' as const, icon: null },
}

export const bookingStatusConfig = {
  pending: { variant: 'warning' as const, icon: null },
  invoiced: { variant: 'secondary' as const, icon: null },
  deposited: { variant: 'success' as const, icon: null },
  instalment_paid: { variant: 'success' as const, icon: null },
  fully_paid: { variant: 'success' as const, icon: null },
  cancelled: { variant: 'destructive' as const, icon: null },
  waitlisted: { variant: 'secondary' as const, icon: null },
  host: { variant: 'default' as const, icon: null },
}

export const taskPriorityConfig = {
  low: { variant: 'default' as const, icon: null },
  medium: { variant: 'secondary' as const, icon: null },
  high: { variant: 'warning' as const, icon: null },
  critical: { variant: 'destructive' as const, icon: null },
}

export const hotelStatusConfig = {
  pending: { variant: 'warning' as const, icon: null },
  confirmed: { variant: 'success' as const, icon: null },
  provisional: { variant: 'secondary' as const, icon: null },
  cancelled: { variant: 'destructive' as const, icon: null },
  waitlisted: { variant: 'secondary' as const, icon: null },
}