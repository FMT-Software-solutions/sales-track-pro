import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { signOut } from '@/lib/auth';
import { useAuthStore } from '@/stores/auth';

interface ChangePasswordProps {
  isFirstTimeReset?: boolean;
  onSuccess?: () => void;
}

export function ChangePassword({ isFirstTimeReset = false, onSuccess }: ChangePasswordProps) {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [isOpen, setIsOpen] = useState(isFirstTimeReset);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const changePasswordMutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword, isFirstTimeReset }: {
      currentPassword: string;
      newPassword: string;
      isFirstTimeReset: boolean;
    }) => {
      if (isFirstTimeReset) {
        // For first-time resets, use the edge function (complex validation needed)
        const { data: session } = await supabase.auth.getSession();
        if (!session.session?.access_token) throw new Error('No access token');

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/change-password`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
            isFirstTimeReset
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to change password');
        }

        return response.json();
      } else {
        // For regular password changes, use Supabase's built-in updateUser method
        // First verify the current password by attempting to sign in
        const { data: user } = await supabase.auth.getUser();
        if (!user.user?.email) throw new Error('User email not found');

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.user.email,
          password: currentPassword
        });

        if (signInError) {
          throw new Error('Current password is incorrect');
        }

        // Update the password using Supabase's built-in method
        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword
        });

        if (updateError) {
          throw new Error(updateError.message || 'Failed to update password');
        }

        return { message: 'Password updated successfully', requiresLogout: true };
      }
    },
    onSuccess: async () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsOpen(false);
      toast.success('Password updated successfully! You will be logged out to ensure session security.');
      
      // Call the onSuccess callback if provided
      onSuccess?.();
      
      // Automatically log out the user after a short delay to show the success message
      setTimeout(async () => {
        try {
          await signOut();
          setUser(null);
          navigate('/login');
        } catch (error) {
          console.error('Auto logout error:', error);
          // If signOut fails (due to corrupted session), manually clear the session
          try {
            // Clear local storage and session storage
            localStorage.clear();
            sessionStorage.clear();
            
            // Clear the user from the auth store
            setUser(null);
            
            // Navigate to login
            navigate('/login');
            
            toast.success('Logged out successfully. Please log in with your new password.');
          } catch (fallbackError) {
            console.error('Fallback logout error:', fallbackError);
            toast.error('Please refresh the page and log in with your new password.');
            // Force page refresh as last resort
            window.location.href = '/login';
          }
        }
      }, 2000);
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    changePasswordMutation.mutate({
      currentPassword,
      newPassword,
      isFirstTimeReset
    });
  };

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!isFirstTimeReset) {
      setIsOpen(open);
      if (!open) {
        resetForm();
      }
    }
  };

  const DialogComponent = isFirstTimeReset ? 'div' : Dialog;
  const DialogContentComponent = isFirstTimeReset ? 'div' : DialogContent;

  return (
    <DialogComponent open={isOpen} onOpenChange={handleOpenChange}>
      {!isFirstTimeReset && (
        <DialogTrigger asChild>
          <Button variant="outline" onClick={() => setIsOpen(true)}>
            <Lock className="mr-2 h-4 w-4" />
            Change Password
          </Button>
        </DialogTrigger>
      )}
      <DialogContentComponent className={isFirstTimeReset ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/50' : ''}>
        {isFirstTimeReset && (
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="text-center">Password Reset Required</CardTitle>
              <CardDescription className="text-center">
                You must change your temporary password before continuing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      placeholder="Enter your temporary password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="Enter your new password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Confirm your new password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button 
                  type="submit" 
                  disabled={changePasswordMutation.isPending} 
                  className="w-full"
                >
                  {changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
        
        {!isFirstTimeReset && (
          <>
            <DialogHeader>
              <DialogTitle>Change Password</DialogTitle>
              <DialogDescription>
                Enter your current password and choose a new one.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button 
                  type="submit" 
                  disabled={changePasswordMutation.isPending} 
                  className="flex-1"
                >
                  {changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContentComponent>
    </DialogComponent>
  );
}