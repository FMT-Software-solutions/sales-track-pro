import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';

export function PasswordReset() {
  const navigate = useNavigate();
  const { user, initialize } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  // Check if this is a first-time password reset
  const isFirstTimeReset =
    user?.user_metadata?.requires_password_reset === true;

  const changePasswordMutation = useMutation({
    mutationFn: async ({
      currentPassword,
      newPassword,
    }: {
      currentPassword?: string;
      newPassword: string;
    }) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) throw new Error('No access token');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/change-password`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            currentPassword: isFirstTimeReset ? undefined : currentPassword,
            newPassword,
            isFirstTimeReset,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to change password');
      }

      return response.json();
    },
    onSuccess: async (data) => {
      toast.success('Password changed successfully!');

      // If we received a new session, set it for auto-login
      if (data.session) {
        await supabase.auth.setSession(data.session);
      } else {
        // Fallback: refresh the current session
        await supabase.auth.refreshSession();
      }

      // Refresh user data to update metadata
      await initialize();

      // Small delay to ensure state is updated
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 500);
    },
    onError: (error) => {
      toast.error(error.message);
    },
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

    // For first-time reset, we don't need current password
    if (!isFirstTimeReset && !currentPassword) {
      toast.error('Current password is required');
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: isFirstTimeReset ? undefined : currentPassword,
      newPassword,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center space-x-2">
              <img src="./icon.png" className="h-10 w-10" />
              <span className="text-2xl font-bold text-gray-900">
                SalesTrack Pro
              </span>
            </div>
          </div>
          <CardTitle className="text-2xl">
            {isFirstTimeReset ? 'Set Your New Password' : 'Change Password'}
          </CardTitle>
          <CardDescription>
            {isFirstTimeReset
              ? 'Please set a new password to complete your account setup.'
              : 'You must change your password before accessing the application.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isFirstTimeReset && (
              <div>
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Enter your current password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
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
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
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
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending
                ? isFirstTimeReset
                  ? 'Setting Password...'
                  : 'Changing Password...'
                : isFirstTimeReset
                ? 'Set Password'
                : 'Change Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
