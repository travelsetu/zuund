'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Avatar } from './Avatar';

export function Nav() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    api.notifications
      .unreadCount()
      .then((r) => !cancelled && setUnread(r.count))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  async function onLogout() {
    setOpen(false);
    await logout();
    router.push('/');
  }

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href="/" className="logo">
          zuund
        </Link>
        <nav className="nav-links" aria-label="Main">
          {user ? (
            <>
              <Link href="/posts" title="My posts">
                🚗 <span className="label">My posts</span>
              </Link>
              <Link href="/messages" title="Messages">
                💬 <span className="label">Messages</span>
              </Link>
              <Link href="/connections" title="Connections">
                🤝 <span className="label">Connections</span>
              </Link>
              <Link href="/notifications" title="Notifications">
                🔔 <span className="label">Notifications</span>
                {unread > 0 && <span className="badge-dot">{unread > 99 ? '99+' : unread}</span>}
              </Link>
              <div className="menu" ref={menuRef}>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={open}
                >
                  <Avatar user={user} />
                </button>
                {open && (
                  <div className="menu-panel" role="menu">
                    <span className="small muted" style={{ padding: '4px 10px' }}>
                      {user.name ?? user.email}
                    </span>
                    <Link href="/profile" onClick={() => setOpen(false)}>
                      Profile
                    </Link>
                    <Link href="/settings" onClick={() => setOpen(false)}>
                      Settings
                    </Link>
                    <button type="button" onClick={onLogout}>
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : loading ? null : (
            <>
              <Link href="/login">Sign in</Link>
              <Link href="/register" className="btn sm">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
