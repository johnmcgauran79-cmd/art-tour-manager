/**
 * Centralized status color system using design tokens
 * This ensures consistent color coding across all status badges
 */

// Booking status colors
export const getBookingStatusColor = (status: string): string => {
  const statusMap: Record<string, string> = {
    'pending': 'bg-status-pending text-status-pending-foreground',
    'invoiced': 'bg-status-invoiced text-status-invoiced-foreground',
    'deposited': 'bg-status-deposited text-status-deposited-foreground',
    'instalment_paid': 'bg-status-instalment-paid text-status-instalment-paid-foreground',
    'fully_paid': 'bg-status-fully-paid text-status-fully-paid-foreground',
    'cancelled': 'bg-status-cancelled text-status-cancelled-foreground',
    'waitlisted': 'bg-status-waitlisted text-status-waitlisted-foreground',
    'host': 'bg-status-pending text-status-pending-foreground',
    'racing_breaks_invoice': 'bg-blue-900 text-white',
  };
  
  return statusMap[status] || statusMap['pending'];
};

// Tour status colors
export const getTourStatusColor = (status: string): string => {
  const statusMap: Record<string, string> = {
    'pending': 'bg-status-pending text-status-pending-foreground',
    'available': 'bg-status-available text-status-available-foreground',
    'limited_availability': 'bg-status-limited-availability text-status-limited-availability-foreground',
    'closed': 'bg-status-closed text-status-closed-foreground',
    'sold_out': 'bg-status-sold-out text-status-sold-out-foreground',
    'past': 'bg-status-past text-status-past-foreground',
    'archived': 'bg-status-archived text-status-archived-foreground',
  };
  
  return statusMap[status] || statusMap['pending'];
};

// Task status colors
export const getTaskStatusColor = (status: string): string => {
  const statusMap: Record<string, string> = {
    'todo': 'bg-status-todo text-status-todo-foreground',
    'in_progress': 'bg-status-in-progress text-status-in-progress-foreground',
    'waiting': 'bg-status-waiting text-status-waiting-foreground',
    'completed': 'bg-status-completed text-status-completed-foreground',
    'cancelled': 'bg-status-cancelled text-status-cancelled-foreground',
    'archived': 'bg-status-archived text-status-archived-foreground',
  };
  
  return statusMap[status] || statusMap['todo'];
};

// Task priority colors
export const getTaskPriorityColor = (priority: string): string => {
  const priorityMap: Record<string, string> = {
    'low': 'bg-priority-low text-priority-low-foreground',
    'medium': 'bg-priority-medium text-priority-medium-foreground',
    'high': 'bg-priority-high text-priority-high-foreground',
    'critical': 'bg-priority-critical text-priority-critical-foreground',
  };
  
  return priorityMap[priority] || priorityMap['medium'];
};

// Format status text for display
export const formatStatusText = (status: string): string => {
  if (status === 'racing_breaks_invoice') {
    return 'RB Invoice';
  }
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};
