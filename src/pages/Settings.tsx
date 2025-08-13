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
import { ChangePassword } from '@/components/auth/ChangePassword';
import { toast } from 'sonner';
import { UpdateSettings } from '@/components/settings/UpdateSettings';
import {
  Settings as SettingsIcon,
  User,
  Shield,
  Building2,
  Users,
} from 'lucide-react';

export function Settings() {
  const { user } = useAuthStore();
  const {
    currentOrganization,
    setCurrentOrganization,
    userOrganizations,
  } = useOrganization();
  const [orgName, setOrgName] = useState(currentOrganization?.name || '');

  const [orgEmail, setOrgEmail] = useState(currentOrganization?.email || '');
  const [orgPhone, setOrgPhone] = useState(currentOrganization?.phone || '');
  const [orgAddress, setOrgAddress] = useState(
    currentOrganization?.address || ''
  );
  const [orgCurrency, setOrgCurrency] = useState(
    currentOrganization?.currency || 'GH₵'
  );

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

      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
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
            user?.profile?.role === 'admin' ? 'grid-cols-3' : 'grid-cols-1'
          }`}
        >
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <RoleGuard allowedRoles={['admin']}>
            <TabsTrigger value="organization">Organization</TabsTrigger>
          </RoleGuard>
          <RoleGuard allowedRoles={['admin']}>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
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
                        user?.profile?.role === 'admin'
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

        <RoleGuard allowedRoles={['admin']}>
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

        <RoleGuard allowedRoles={['admin']}>
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
      </Tabs>
    </div>
  );
}
