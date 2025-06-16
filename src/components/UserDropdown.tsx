
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, User, KeyRound } from 'lucide-react';
import { PasswordChangeModal } from './PasswordChangeModal';

export const UserDropdown = () => {
  const { user, profile, userRole, signOut } = useAuth();
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  if (!user) return null;

  const displayName = profile 
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() 
    : user.email?.split('@')[0] || 'User';

  const initials = profile 
    ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`
    : user.email?.[0]?.toUpperCase() || 'U';

  const roleDisplayName = userRole 
    ? userRole.charAt(0).toUpperCase() + userRole.slice(1).replace('_', ' ')
    : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-brand-navy text-brand-yellow">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {displayName}
                {roleDisplayName && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ({roleDisplayName})
                  </span>
                )}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowPasswordChange(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            <span>Change Password</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PasswordChangeModal
        open={showPasswordChange}
        onOpenChange={setShowPasswordChange}
        onPasswordChanged={() => {
          // Refresh user data after password change
          window.location.reload();
        }}
      />
    </>
  );
};
