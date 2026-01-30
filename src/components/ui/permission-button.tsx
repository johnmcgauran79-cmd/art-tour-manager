import { useState, forwardRef } from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PermissionErrorDialog } from "@/components/PermissionErrorDialog";
import { usePermissions, ResourceType, ActionType } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";

interface PermissionButtonProps extends Omit<ButtonProps, 'onClick'> {
  resource: ResourceType;
  action: ActionType;
  onClick?: () => void;
  /** Custom action description for the error dialog */
  actionDescription?: string;
  /** Optional context for permission checking */
  context?: { tourId?: string; isAssigned?: boolean };
  /** If true, completely hide the button instead of disabling it */
  hideWhenDisabled?: boolean;
}

/**
 * A button that automatically checks permissions and shows a dialog when clicked without permission.
 * - Shows as disabled/greyed out when user doesn't have permission
 * - Displays tooltip explaining why it's disabled
 * - Shows permission error dialog when clicked
 */
export const PermissionButton = forwardRef<HTMLButtonElement, PermissionButtonProps>(
  ({ 
    resource, 
    action, 
    onClick, 
    actionDescription,
    context,
    hideWhenDisabled = false,
    className,
    children,
    disabled,
    ...props 
  }, ref) => {
    const { canPerformAction } = usePermissions();
    const [showPermissionDialog, setShowPermissionDialog] = useState(false);

    const permission = canPerformAction(resource, action, context);
    const isDisabled = disabled || !permission.allowed;

    // Generate a readable action description for the dialog
    const getActionDescription = () => {
      if (actionDescription) return actionDescription;
      
      const resourceLabels: Record<ResourceType, string> = {
        booking: 'bookings',
        tour: 'tours',
        activity: 'activities',
        task: 'tasks',
        contact: 'contacts',
        hotel: 'hotels',
        itinerary: 'itineraries',
        email_template: 'email templates',
        automated_email_rule: 'automated email rules',
        automated_report_rule: 'automated report rules',
        task_template: 'task templates',
        system_settings: 'system settings',
        user_management: 'user management',
      };

      return `${action} ${resourceLabels[resource] || resource}`;
    };

    const handleClick = () => {
      if (!permission.allowed) {
        setShowPermissionDialog(true);
        return;
      }
      onClick?.();
    };

    // Hide button completely if specified
    if (hideWhenDisabled && !permission.allowed) {
      return null;
    }

    const button = (
      <Button
        ref={ref}
        className={cn(
          isDisabled && !disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        disabled={disabled}
        onClick={handleClick}
        {...props}
      >
        {children}
      </Button>
    );

    return (
      <>
        {!permission.allowed ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {button}
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{permission.reason || "You don't have permission"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          button
        )}

        <PermissionErrorDialog
          open={showPermissionDialog}
          onOpenChange={setShowPermissionDialog}
          action={getActionDescription()}
        />
      </>
    );
  }
);

PermissionButton.displayName = "PermissionButton";
