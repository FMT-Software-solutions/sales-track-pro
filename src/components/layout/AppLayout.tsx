import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth';
import { signOut } from '@/lib/auth';
import { OrganizationSelector } from '@/components/OrganizationSelector';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import { HelpDrawer } from '@/components/layout/HelpDrawer';
import { UpdateDrawer } from '@/components/layout/UpdateDrawer';
import { useUpdateStore } from '@/stores/updateStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  Building2,
  Plus,
  Minus,
  FileText,
  Settings,
  LogOut,
  RefreshCw,
  Users,
  Logs,
  HelpCircle,
  Download,
} from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Branches', href: '/branches', icon: Building2, role: 'admin' },
  { name: 'Sales', href: '/sales', icon: Plus },
  { name: 'Expenses', href: '/expenses', icon: Minus },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Activity logs', href: '/activities', icon: Logs, role: 'manager' },
  { name: 'User Management', href: '/users', icon: Users, role: 'admin' },
  { name: 'Profile & Settings', href: '/settings', icon: Settings },
];

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const {
    canManageAllData,
    canManageBranchData,
    canViewAllData,
    isBranchManager,
  } = useRoleCheck();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHelpDrawerOpen, setIsHelpDrawerOpen] = useState(false);
  const [isUpdateDrawerOpen, setIsUpdateDrawerOpen] = useState(false);
  const { hasUpdate } = useUpdateStore();

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      navigate('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    window.location.reload();
  };

  const filteredNavigation = navigation.filter((item) => {
    if (!item.role) return true;
    if (item.name === 'User Management') return canManageBranchData();
    if (item.name === 'Activity logs')
      return canViewAllData() || isBranchManager();
    return item.role === 'admin' && canManageAllData();
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-16 md:w-64 bg-white shadow-lg transition-all duration-200">
        <div className="flex h-16 items-center justify-center border-b border-gray-200 px-6">
          <div className="flex items-center space-x-2">
            <img src="./icon.png" className="md:h-10 md:w-10" />
            <span className="hidden md:inline text-xl font-bold text-gray-900">
              SalesTrack Pro
            </span>
          </div>
        </div>

        <nav className="mt-6 px-3">
          <div className="space-y-1">
            {filteredNavigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'group flex flex-col md:flex-row items-center md:items-center rounded-md px-2 md:px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <item.icon
                    className={cn(
                      'h-6 w-6 flex-shrink-0',
                      isActive
                        ? 'text-blue-500'
                        : 'text-gray-400 group-hover:text-gray-500'
                    )}
                  />
                  <span className="hidden md:inline ml-0 md:ml-3">
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User info and sign out */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 p-2 md:p-4">
          <div className="flex flex-col md:flex-row items-center md:justify-between">
            <div className="flex-1 min-w-0 hidden md:block">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.profile?.full_name}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {user?.profile?.role?.replace('_', ' ')}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="ml-0 md:ml-2"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-16 md:pl-64 transition-all duration-200">
        {/* Top header with help and organization selector */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4 sticky top-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 relative"
                  >
                    <HelpCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Help</span>
                    {hasUpdate && (
                      <Badge
                        variant="destructive"
                        className="absolute top-0 right-0 h-2 w-2 p-0 rounded-full"
                      />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setIsHelpDrawerOpen(true)}
                  >
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Help and Support
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer flex items-center"
                    onClick={() => setIsUpdateDrawerOpen(true)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Check for updates
                    {hasUpdate && (
                      <Badge
                        variant="destructive"
                        className="ml-2 h-2 w-2 p-0 rounded-full"
                      />
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-8 w-8"
                aria-label="Refresh page"
              >
                <RefreshCw
                  className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
                />
              </Button>
              <OrganizationSelector />
            </div>
          </div>
        </div>

        <main className="py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>

      <HelpDrawer open={isHelpDrawerOpen} onOpenChange={setIsHelpDrawerOpen} />
      <UpdateDrawer
        isOpen={isUpdateDrawerOpen}
        onOpenChange={setIsUpdateDrawerOpen}
      >
        <></>
      </UpdateDrawer>
    </div>
  );
}
