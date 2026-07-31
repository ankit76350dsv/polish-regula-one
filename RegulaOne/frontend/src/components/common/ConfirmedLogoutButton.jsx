import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLogout } from '../../hooks/useAuth';

/**
 * Reusable sign-out control. Keeping the confirmation beside the logout hook
 * ensures every RegulaOne sign-out entry point follows the same safe flow.
 */
export default function ConfirmedLogoutButton({
  children,
  className,
  variant = 'ghost',
  size,
  title = 'Sign out',
  ariaLabel = 'Sign out',
}) {
  const [open, setOpen] = useState(false);
  const logout = useLogout();

  const confirmLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => setOpen(false),
    });
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        title={title}
        aria-label={ariaLabel}
        disabled={logout.isPending}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>

      <Dialog open={open} onOpenChange={(nextOpen) => !logout.isPending && setOpen(nextOpen)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign out?</DialogTitle>
            <DialogDescription>
              Do you really want to sign out? You will need to sign in again to access RegulaOne.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={logout.isPending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={logout.isPending} onClick={confirmLogout}>
              {logout.isPending ? 'Signing out…' : 'Sign out'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
