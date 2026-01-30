import { useAuth } from "./useAuth";

export type ResourceType = 
  | 'booking' 
  | 'tour' 
  | 'activity' 
  | 'task' 
  | 'contact' 
  | 'hotel' 
  | 'itinerary'
  | 'email_template'
  | 'automated_email_rule'
  | 'automated_report_rule'
  | 'task_template'
  | 'system_settings'
  | 'user_management';

export type ActionType = 'create' | 'edit' | 'delete' | 'view';

interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Centralized permission checking hook
 * 
 * Permission Matrix:
 * - Admin: Full access to everything
 * - Manager: Full access to most things (bookings, tours, activities, tasks, contacts, settings)
 * - Booking Agent: View-only access
 * - Agent: View-only access
 * - Host: View-only on assigned tours, can update tour hosts notes and customer avatars
 */
export const usePermissions = () => {
  const { userRole } = useAuth();

  const canPerformAction = (
    resource: ResourceType, 
    action: ActionType,
    context?: { tourId?: string; isAssigned?: boolean }
  ): PermissionResult => {
    // Admin has full access
    if (userRole === 'admin') {
      return { allowed: true };
    }

    // Manager has full access to most things
    if (userRole === 'manager') {
      return { allowed: true };
    }

    // Host has very limited edit access
    if (userRole === 'host') {
      // Hosts can only view, with specific exceptions handled elsewhere
      // (tour hosts notes and customer avatars are handled at component level)
      if (action === 'view') {
        return { allowed: true };
      }
      return { 
        allowed: false, 
        reason: 'Host users have view-only access. Contact your tour manager for changes.' 
      };
    }

    // Agent has view-only access
    if (userRole === 'agent') {
      if (action === 'view') {
        return { allowed: true };
      }
      return { 
        allowed: false, 
        reason: 'Agent users have view-only access. Contact your manager for changes.' 
      };
    }

    // Booking Agent has view-only access
    if (userRole === 'booking_agent') {
      if (action === 'view') {
        return { allowed: true };
      }
      return { 
        allowed: false, 
        reason: 'Booking agents have view-only access. Contact your manager for changes.' 
      };
    }

    // Default: no access if role is unknown
    return { 
      allowed: false, 
      reason: 'You do not have permission to perform this action.' 
    };
  };

  // Convenience methods for common checks
  const canEdit = (resource: ResourceType, context?: { tourId?: string; isAssigned?: boolean }) => 
    canPerformAction(resource, 'edit', context);
  
  const canCreate = (resource: ResourceType, context?: { tourId?: string; isAssigned?: boolean }) => 
    canPerformAction(resource, 'create', context);
  
  const canDelete = (resource: ResourceType, context?: { tourId?: string; isAssigned?: boolean }) => 
    canPerformAction(resource, 'delete', context);

  // Check if user has any edit permissions at all
  const hasEditAccess = userRole === 'admin' || userRole === 'manager';

  // Check if user is view-only
  const isViewOnly = userRole === 'agent' || userRole === 'booking_agent' || userRole === 'host';

  return {
    userRole,
    canPerformAction,
    canEdit,
    canCreate,
    canDelete,
    hasEditAccess,
    isViewOnly,
  };
};
