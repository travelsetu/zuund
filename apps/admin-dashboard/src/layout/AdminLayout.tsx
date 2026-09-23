import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '@/auth/AuthContext';

const NAV: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/', label: 'Overview', end: true },
  { to: '/users', label: 'Users' },
  { to: '/buying-posts', label: 'Buying posts' },
  { to: '/collectives', label: 'Collectives' },
  { to: '/payments', label: 'Payments' },
  { to: '/buying-passes', label: 'Buying passes' },
  { to: '/reports', label: 'Reports' },
  { to: '/audit-logs', label: 'Audit logs' },
];

/** Sidebar shell. Also the client-side role gate; the server enforces ADMIN on every /admin route regardless. */
export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (user && !isAdmin) {
      const t = setTimeout(() => {
        void logout().then(() => navigate('/login', { replace: true }));
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [user, isAdmin, logout, navigate]);

  if (user && !isAdmin) {
    return (
      <div className="centered">
        <div className="card">
          <h1>Not an admin</h1>
          <p className="muted">This account is not an admin. Signing you out…</p>
        </div>
      </div>
    );
  }

  async function onLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          ZUUND <span className="muted">admin</span>
        </div>
        <nav>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="muted small-text">{user?.email}</div>
          <button type="button" className="secondary small" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
