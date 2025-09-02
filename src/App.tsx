import { useEffect } from 'react';
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { useAuthStore } from '@/stores/auth';
import { useAutoUpdateCheck } from '@/hooks/useAutoUpdateCheck';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { Branches } from '@/pages/Branches';
import { Reports } from '@/pages/Reports';
import { Settings } from '@/pages/Settings';
import UserManagement from '@/pages/UserManagement';
import { PasswordReset } from '@/pages/PasswordReset';
import Sales from './pages/Sales';
import Expenses from './pages/Expenses';
import Activities from './pages/Activities';
// import EdgeFunctionTest from './pages/EdgeFunctionTest';
// import TestCreateOwner from './pages/TestCreateOwner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const initialize = useAuthStore((state) => state.initialize);
  
  // Initialize automatic update checking
  useAutoUpdateCheck();

  useEffect(() => {
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Remove initialize from dependencies to prevent re-initialization

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/password-reset" element={<PasswordReset />} />
          {/* <Route path="/edge-function-test" element={<EdgeFunctionTest />} /> */}
          {/* <Route path="/test-create-owner" element={<TestCreateOwner />} /> */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <OrganizationProvider>
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                </OrganizationProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/branches"
            element={
              <ProtectedRoute allowedRoles={['owner', 'admin']}>
                <OrganizationProvider>
                  <AppLayout>
                    <Branches />
                  </AppLayout>
                </OrganizationProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sales"
            element={
              <ProtectedRoute>
                <OrganizationProvider>
                  <AppLayout>
                    <Sales />
                  </AppLayout>
                </OrganizationProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <ProtectedRoute>
                <OrganizationProvider>
                  <AppLayout>
                    <Expenses />
                  </AppLayout>
                </OrganizationProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <OrganizationProvider>
                  <AppLayout>
                    <Reports />
                  </AppLayout>
                </OrganizationProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute
                allowedRoles={['owner', 'admin', 'branch_manager']}
              >
                <OrganizationProvider>
                  <AppLayout>
                    <UserManagement />
                  </AppLayout>
                </OrganizationProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <OrganizationProvider>
                  <AppLayout>
                    <Settings />
                  </AppLayout>
                </OrganizationProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/activities"
            element={
              <ProtectedRoute
                allowedRoles={['owner', 'admin', 'branch_manager', 'auditor']}
              >
                <OrganizationProvider>
                  <AppLayout>
                    <Activities />
                  </AppLayout>
                </OrganizationProvider>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
      <ConnectionStatus />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
