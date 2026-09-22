import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { AuthProvider } from '@/auth/AuthContext';
import { RequireAuth } from '@/auth/RequireAuth';
import { AdminLayout } from '@/layout/AdminLayout';
import { AuditLogsPage } from '@/pages/admin/AuditLogsPage';
import { BuyingPassesPage } from '@/pages/admin/BuyingPassesPage';
import { BuyingPostDetailPage } from '@/pages/admin/BuyingPostDetailPage';
import { BuyingPostsPage } from '@/pages/admin/BuyingPostsPage';
import { CollectiveDetailPage } from '@/pages/admin/CollectiveDetailPage';
import { CollectivesPage } from '@/pages/admin/CollectivesPage';
import { OverviewPage } from '@/pages/admin/OverviewPage';
import { PaymentDetailPage } from '@/pages/admin/PaymentDetailPage';
import { PaymentsPage } from '@/pages/admin/PaymentsPage';
import { ReportsPage } from '@/pages/admin/ReportsPage';
import { UserDetailPage } from '@/pages/admin/UserDetailPage';
import { UsersPage } from '@/pages/admin/UsersPage';
import { LoginPage } from '@/pages/LoginPage';

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { path: '/', element: <OverviewPage /> },
          { path: '/users', element: <UsersPage /> },
          { path: '/users/:id', element: <UserDetailPage /> },
          { path: '/buying-posts', element: <BuyingPostsPage /> },
          { path: '/buying-posts/:id', element: <BuyingPostDetailPage /> },
          { path: '/collectives', element: <CollectivesPage /> },
          { path: '/collectives/:id', element: <CollectiveDetailPage /> },
          { path: '/payments', element: <PaymentsPage /> },
          { path: '/payments/:id', element: <PaymentDetailPage /> },
          { path: '/buying-passes', element: <BuyingPassesPage /> },
          { path: '/reports', element: <ReportsPage /> },
          { path: '/audit-logs', element: <AuditLogsPage /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
