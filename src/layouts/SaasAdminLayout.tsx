import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { SidebarItem } from '../components/ui/SidebarItem';
import { Dropdown } from '../components/ui/Dropdown';
import { cn } from '../lib/cn';
import { useAuth } from '../features/auth/AuthContext';

const NAV_ITEMS = [
  { to: '/saas/dashboard', label: 'Dashboard', enabled: true },
  { to: '/saas/stores', label: 'Stores', enabled: true },
  { to: '/saas/subscriptions', label: 'Subscriptions', enabled: true },
  { to: '/saas/plans', label: 'Plans', enabled: true },
  { to: '/saas/users', label: 'SaaS Users', enabled: false },
  { to: '/saas/settings', label: 'Settings', enabled: false },
  { to: '/saas/audit-logs', label: 'Audit Logs', enabled: false },
];

/**
 * Base layout for the platform-level SaaS Admin application. Deliberately a
 * separate component tree from StoreAppLayout so the two apps never share
 * navigation state, styling assumptions, or accidental data access.
 */
export function SaasAdminLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { principal, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/saas/login', { replace: true });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-brand-50">
      <aside className="hidden w-64 shrink-0 flex-col bg-brand-900 text-white lg:flex">
        <Brand />
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <SidebarItem key={item.to} to={item.to} label={item.label} disabled={!item.enabled} />
          ))}
        </nav>
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-brand-950/50"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-brand-900 text-white shadow-xl">
            <Brand />
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              {NAV_ITEMS.map((item) => (
                <div key={item.to} onClick={() => setMobileNavOpen(false)}>
                  <SidebarItem to={item.to} label={item.label} disabled={!item.enabled} />
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      <div className={cn('flex min-w-0 flex-1 flex-col')}>
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-brand-100 bg-white px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="rounded-md p-2 text-brand-600 hover:bg-brand-50 lg:hidden"
            aria-label="Open navigation"
          >
            ☰
          </button>
          <span className="hidden text-sm font-medium text-brand-500 lg:block">
            SaaS Platform Administration
          </span>
          <Dropdown
            align="right"
            trigger={
              <div className="flex items-center gap-2">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-200 text-xs font-semibold text-brand-800"
                  aria-hidden="true"
                >
                  {principal && principal.kind === 'saas_admin' ? principal.fullName.slice(0, 1).toUpperCase() : ''}
                </div>
                <span className="hidden text-sm font-medium text-brand-700 sm:block">
                  {principal && principal.kind === 'saas_admin' ? principal.fullName : ''}
                </span>
              </div>
            }
            items={[{ label: 'Sign out', onSelect: handleLogout, danger: true }]}
          />
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex h-16 items-center border-b border-white/10 px-4">
      <span className="text-sm font-semibold tracking-wide">SaaS Admin</span>
    </div>
  );
}
