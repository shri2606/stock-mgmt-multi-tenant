import { NavLink, Outlet } from 'react-router-dom';
import { useTenant } from '../lib/tenant';
import { useState } from 'react';

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

export function Layout() {
  const { tenant } = useTenant();

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
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <p className="sidebar-foot muted small">
          The tenant is whatever you type. Nothing verifies it.
        </p>
      </aside>

      <main className="main">
        <header className="topbar">
          <TenantSwitcher />
          <span className={`pill ${tenant ? 'pill-on' : 'pill-off'}`}>
            {tenant ? `tenant: ${tenant}` : 'no tenant set'}
          </span>
        </header>

        <section className="content">
          {tenant ? (
            <Outlet />
          ) : (
            <div className="empty">
              Set a tenant above to begin. Every request needs the
              <code> X-Tenant-ID </code> header, and the API rejects calls without it
              with a 400.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
