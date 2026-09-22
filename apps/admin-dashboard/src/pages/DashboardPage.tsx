import { useNavigate } from 'react-router';
import { useAuth } from '@/auth/AuthContext';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="page">
      <header className="topbar">
        <strong>jhoond</strong>
        <div className="topbar-right">
          <span className="muted">{user?.email}</span>
          <button type="button" className="secondary" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>
      <main>
        <h1>Dashboard</h1>
        <p className="muted">You're signed in. Nothing to see here yet.</p>
      </main>
    </div>
  );
}
