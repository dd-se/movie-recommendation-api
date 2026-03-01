import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/AuthProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import Layout from '@/components/Layout';
import RequireScope from '@/components/RequireScope';
import DiscoverPage from '@/pages/DiscoverPage';
import ExplorePage from '@/pages/ExplorePage';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import ProfilePage from '@/pages/ProfilePage';
import AdminLayout from '@/features/admin/components/AdminLayout';
import OverviewPage from '@/features/admin/pages/OverviewPage';
import UsersPage from '@/features/admin/pages/UsersPage';
import DatabasePage from '@/features/admin/pages/DatabasePage';
import QueuePage from '@/features/admin/pages/QueuePage';
import SystemPage from '@/features/admin/pages/SystemPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route element={<Layout />}>
                <Route path="/" element={<DiscoverPage />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
              <Route
                path="/admin"
                element={
                  <RequireScope scope="movie:write">
                    <AdminLayout />
                  </RequireScope>
                }
              >
                <Route index element={<OverviewPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="database" element={<DatabasePage />} />
                <Route path="queue" element={<QueuePage />} />
                <Route path="system" element={<SystemPage />} />
              </Route>
            </Routes>
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
