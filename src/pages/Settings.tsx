import { useState, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useAuthStore } from '@/stores/auth';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useUpdateOrganization, useUpdateProfile } from '@/hooks/queries';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import { ChangePassword } from '@/components/auth/ChangePassword';
import { toast } from 'sonner';
import { UpdateSettings } from '@/components/settings/UpdateSettings';
import {
  Settings as SettingsIcon,
  User,
  Shield,
  Building2,
  Users,
  Lock,
} from 'lucide-react';

export function Settings() {
  const { user, setUser } = useAuthStore();
  const {
    currentOrganization,
    setCurrentOrganization,
    userOrganizations,
  } = useOrganization();
  const { canViewAllData } = useRoleCheck();
  const [orgName, setOrgName] = useState(currentOrganization?.name || '');

  const [orgEmail, setOrgEmail] = useState(currentOrganization?.email || '');
  const [orgPhone, setOrgPhone] = useState(currentOrganization?.phone || '');
  const [orgAddress, setOrgAddress] = useState(
    currentOrganization?.address || ''
  );
  const [orgCurrency, setOrgCurrency] = useState(
    currentOrganization?.currency || 'GH₵'
  );

  // Period closing state
  const [closingDate, setClosingDate] = useState('');
  const [closingReason, setClosingReason] = useState('');
  const [isClosingPeriod, setIsClosingPeriod] = useState(false);

  // Profile form refs
  const fullNameRef = useRef<HTMLInputElement>(null);

  const updateOrganizationMutation = useUpdateOrganization();
  const updateProfileMutation = useUpdateProfile();

  const handleUpdateOrganization = async () => {
    if (!currentOrganization) return;

    try {
      const updatedOrg = await updateOrganizationMutation.mutateAsync({
        id: currentOrganization.id,
        name: orgName,
        email: orgEmail,
        phone: orgPhone,
        address: orgAddress,
        currency: orgCurrency,
      });

      // Update the current organization in context with the new data
      setCurrentOrganization(updatedOrg);

      toast.success('Organization updated successfully');
    } catch (error) {
      console.error('Error updating organization:', error);
      toast.error('Failed to update organization');
    }
  };

  const handleUpdateProfile = async () => {
    if (!user?.id) return;

    const fullName = fullNameRef.current?.value;
    if (!fullName) {
      toast.error('Please enter your full name');
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        id: user.id,
        full_name: fullName,
      });

      // Update the auth store with the new profile data
      if (user?.profile) {
        setUser({
          ...user,
          profile: {
            ...user.profile,
            full_name: fullName,
          },
        });
      }

      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    }
  };

  const handleClosePeriod = async () => {
    if (!closingDate || !closingReason.trim()) {
      toast.error('Please provide both closing date and reason');
      return;
    }

    setIsClosingPeriod(true);
    try {
      // This would typically call an API to close the period
      // For now, we'll just show a success message
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate API call

      toast.success('Period closed successfully');
      setClosingDate('');
      setClosingReason('');
    } catch (error) {
      toast.error('Failed to close period');
    } finally {
      setIsClosingPeriod(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your account settings and application preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList
          className={`grid w-full ${
            canViewAllData() ? 'grid-cols-4' : 'grid-cols-1'
          }`}
        >
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <RoleGuard allowedRoles={['owner', 'admin', 'auditor']}>
            <TabsTrigger value="organization">Organization</TabsTrigger>
          </RoleGuard>
          <RoleGuard allowedRoles={['owner', 'admin', 'auditor']}>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
          </RoleGuard>
          <RoleGuard allowedRoles={['owner', 'admin']}>
            <TabsTrigger value="period-closing">Period Closing</TabsTrigger>
          </RoleGuard>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
            {/* Profile Settings */}
            <Card className="col-span-1 lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="mr-2 h-5 w-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Update your personal information and account details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="full-name">Full Name</Label>
                    <Input
                      id="full-name"
                      ref={fullNameRef}
                      defaultValue={user?.profile?.full_name || ''}
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      defaultValue={user?.email || ''}
                      disabled
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant={
                        canViewAllData()
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      <Shield className="mr-1 h-3 w-3" />
                      {user?.profile?.role?.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col-reverse md:flex-row md:justify-between md:items-center">
                  <ChangePassword />
                  <div className="flex justify-between md:justify-start space-x-4 mb-8 md:mb-0">
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (fullNameRef.current) {
                          fullNameRef.current.value =
                            user?.profile?.full_name || '';
                        }
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleUpdateProfile}
                      disabled={updateProfileMutation.isPending}
                    >
                      {updateProfileMutation.isPending
                        ? 'Saving...'
                        : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Organizations List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="mr-2 h-5 w-5" />
                  Organizations
                </CardTitle>
                <CardDescription>Organizations you belong to</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {userOrganizations?.map((userOrg) => (
                  <div
                    key={userOrg.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">
                        {userOrg.organizations?.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {userOrg.role}
                      </p>
                    </div>
                    {userOrg.organizations?.id === currentOrganization?.id && (
                      <Badge variant="default">Current</Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <RoleGuard allowedRoles={['owner', 'admin', 'auditor']}>
          <TabsContent value="organization" className="space-y-6">
            {currentOrganization && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building2 className="mr-2 h-5 w-5" />
                    Organization Settings
                  </CardTitle>
                  <CardDescription>
                    Manage your organization details and settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="org-name">Organization Name</Label>
                      <Input
                        id="org-name"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="Enter organization name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="org-email">Email</Label>
                      <Input
                        id="org-email"
                        type="email"
                        value={orgEmail}
                        onChange={(e) => setOrgEmail(e.target.value)}
                        placeholder="Enter organization email"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="org-phone">Phone</Label>
                      <Input
                        id="org-phone"
                        value={orgPhone}
                        onChange={(e) => setOrgPhone(e.target.value)}
                        placeholder="Enter organization phone"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="org-currency">Currency</Label>
                      <Input
                        id="org-currency"
                        value={orgCurrency}
                        onChange={(e) => setOrgCurrency(e.target.value)}
                        placeholder="Enter currency symbol"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="org-address">Address</Label>
                    <Input
                      id="org-address"
                      value={orgAddress}
                      onChange={(e) => setOrgAddress(e.target.value)}
                      placeholder="Enter organization address"
                    />
                  </div>

                  <Separator />

                  <div className="flex justify-end space-x-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setOrgName(currentOrganization.name || '');
                        setOrgEmail(currentOrganization.email || '');
                        setOrgPhone(currentOrganization.phone || '');
                        setOrgAddress(currentOrganization.address || '');
                        setOrgCurrency(currentOrganization.currency || 'GH₵');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleUpdateOrganization}
                      disabled={updateOrganizationMutation.isPending}
                    >
                      {updateOrganizationMutation.isPending
                        ? 'Saving...'
                        : 'Save Changes'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </RoleGuard>

        <RoleGuard allowedRoles={['owner', 'admin', 'auditor']}>
          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <SettingsIcon className="mr-2 h-5 w-5" />
                  Application Preferences
                </CardTitle>
                <CardDescription>
                  Configure your application settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Default Currency</Label>
                  <p className="text-sm text-muted-foreground">
                    {currentOrganization?.currency || 'GH₵'} -{' '}
                    <span
                      className="text-blue-600 cursor-pointer hover:underline"
                      onClick={() =>
                        (document.querySelector(
                          '[value="organization"]'
                        ) as HTMLElement)?.click()
                      }
                    >
                      Edit in Organization settings
                    </span>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Date Format</Label>
                  <p className="text-sm text-muted-foreground">MM/DD/YYYY</p>
                </div>
              </CardContent>
            </Card>

            {/* Software Updates */}
            <UpdateSettings />
          </TabsContent>
        </RoleGuard>

        <RoleGuard allowedRoles={['admin', 'owner']}>
          <TabsContent value="period-closing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Lock className="mr-2 h-5 w-5" />
                  Period Closing
                </CardTitle>
                <CardDescription>
                  Close accounting periods to prevent further modifications to
                  sales data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-yellow-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">
                        Important Notice
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>
                          Closing a period will prevent any modifications to
                          sales data before the specified date. This action
                          cannot be undone. Please ensure all corrections and
                          adjustments are completed before proceeding.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="closing-date">Closing Date</Label>
                    <Input
                      id="closing-date"
                      type="date"
                      value={closingDate}
                      onChange={(e) => setClosingDate(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                    />
                    <p className="text-xs text-muted-foreground">
                      All sales data up to and including this date will be
                      locked
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="closing-reason">Reason for Closing</Label>
                    <Input
                      id="closing-reason"
                      value={closingReason}
                      onChange={(e) => setClosingReason(e.target.value)}
                      placeholder="e.g., Month-end closing, Audit preparation"
                    />
                    <p className="text-xs text-muted-foreground">
                      Provide a reason for this period closing
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium">
                    Recent Period Closings
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                      <div>
                        <p className="text-sm font-medium">December 2024</p>
                        <p className="text-xs text-muted-foreground">
                          Closed on Jan 5, 2025 - Month-end closing
                        </p>
                      </div>
                      <Badge variant="secondary">Closed</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                      <div>
                        <p className="text-sm font-medium">November 2024</p>
                        <p className="text-xs text-muted-foreground">
                          Closed on Dec 3, 2024 - Audit preparation
                        </p>
                      </div>
                      <Badge variant="secondary">Closed</Badge>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleClosePeriod}
                    disabled={
                      isClosingPeriod || !closingDate || !closingReason.trim()
                    }
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isClosingPeriod ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Closing Period...
                      </>
                    ) : (
                      <>
                        <Lock className="mr-2 h-4 w-4" />
                        Close Period
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </RoleGuard>
      </Tabs>
    </div>
  );
}
