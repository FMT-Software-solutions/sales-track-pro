import { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { useAuthStore } from '@/stores/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { Branches } from '@/pages/Branches';
import { Reports } from '@/pages/Reports';
import { Settings } from '@/pages/Settings';
import Sales from './pages/Sales';
import Expenses from './pages/Expenses';

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

  useEffect(() => {
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Remove initialize from dependencies to prevent re-initialization

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
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
              <ProtectedRoute requiredRole="admin">
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
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
