import { NavLink, Outlet } from 'react-router-dom';
import { useTenant } from '../lib/tenant';
import { useState } from 'react';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { useQueryClient } from '@tanstack/react-query';
import { AuthError } from '@azure/msal-browser';
import { loginRequest } from '../lib/auth';
import { useToast } from './Toast';

const NAV = [
  { to: '/categories', label: 'Categories' },
  { to: '/products', label: 'Products' },
  { to: '/stocks', label: 'Stock movements' },
];

function TenantSwitcher() {
  const { tenant, setTenant } = useTenant();
  const [draft, setDraft] = useState(tenant);

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    setTenant(draft);
  };

  return (
    <form className="tenant-switcher" onSubmit={apply}>
      <label htmlFor="tenant">X-Tenant-ID</label>
      <input
        id="tenant"
        value={draft}
        placeholder="e.g. alpha"
        onChange={(event) => setDraft(event.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      <button className="btn" type="submit" disabled={draft.trim().toLowerCase() === tenant}>
        Switch
      </button>
    </form>
  );
}

function AccountBadge() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    try {
      // Redirect, not popup. The popup flow hung waiting for the window to come
      // back (MSAL `timed_out`) and, with the SPA's origin as the redirect
      // target, failed with `block_nested_popups` before that. A redirect has no
      // window to block, nest or poll. main.tsx handles the response on return.
      await instance.loginRedirect(loginRequest);
    } catch (error) {
      // An Entra failure carries a code that says exactly what is wrong.
      // Swallowing it leaves nothing to debug.
      const message =
        error instanceof AuthError ? `${error.errorCode}: ${error.errorMessage}` : String(error);
      notify('error', message);
      console.error('MSAL sign-in failed', error);
      setBusy(false);
    }
    // No `finally`: on success the browser is already navigating away, and
    // clearing `busy` would flash the button back to its idle label.
  };

  const signOut = async () => {
    // Drop every cached response first: it was fetched as this user and must not
    // be visible to the next one.
    queryClient.clear();
    await instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
  };

  if (!isAuthenticated) {
    return (
      <button className="btn primary" onClick={signIn} disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in with Microsoft'}
      </button>
    );
  }

  const account = accounts[0];
  return (
    <span className="account">
      <span className="muted small">{account?.name ?? account?.username}</span>
      <button className="btn ghost" onClick={signOut}>
        Sign out
      </button>
    </span>
  );
}

export function Layout() {
  const { tenant } = useTenant();
  const isAuthenticated = useIsAuthenticated();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">SM</span>
          <div>
            <strong>Stock Management</strong>
            <span className="muted small">shared schema</span>
          </div>
        </div>
        <nav>
          {isAuthenticated
            ? NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))
            : NAV.map((item) => (
                // Shown but inert before sign-in: one sign-in covers all three
                // screens, and live links would just bounce off the gate below.
                <span key={item.to} className="nav-link nav-link-locked">
                  {item.label}
                </span>
              ))}
        </nav>
        <p className="sidebar-foot muted small">
          Entra ID proves who you are. It does not decide which tenant you may
          use — that is still whatever you type, and nothing verifies it.
        </p>
      </aside>

      <main className="main">
        <header className="topbar">
          <TenantSwitcher />
          <span className="topbar-right">
            <span className={`pill ${tenant ? 'pill-on' : 'pill-off'}`}>
              {tenant ? `tenant: ${tenant}` : 'no tenant set'}
            </span>
            <AccountBadge />
          </span>
        </header>

        <section className="content">
          {!isAuthenticated ? (
            <div className="empty">
              Sign in to continue. Every request to <code>/api/v1</code> needs a
              bearer token from Entra ID, and the API answers 401 without one.
            </div>
          ) : tenant ? (
            <Outlet />
          ) : (
            <div className="empty">
              Set a tenant above to begin. Every request also needs the
              <code> X-Tenant-ID </code> header, and the API rejects calls without it
              with a 400.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
