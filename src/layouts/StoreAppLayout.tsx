import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarItem } from '../components/ui/SidebarItem';
import { cn } from '../lib/cn';

const NAV_ITEMS = [
  { to: '/app/dashboard', label: 'Dashboard', enabled: true },
  { to: '/app/pos', label: 'POS', enabled: false },
  { to: '/app/sales', label: 'Sales', enabled: false },
  { to: '/app/purchases', label: 'Purchases', enabled: false },
  { to: '/app/inventory', label: 'Inventory', enabled: false },
  { to: '/app/products', label: 'Products', enabled: false },
  { to: '/app/customers', label: 'Customers', enabled: false },
  { to: '/app/suppliers', label: 'Suppliers', enabled: false },
  { to: '/app/expenses', label: 'Expenses', enabled: false },
  { to: '/app/accounting', label: 'Accounting', enabled: false },
  { to: '/app/reports', label: 'Reports', enabled: false },
  { to: '/app/administration', label: 'Administration', enabled: false },
];

/**
 * Base layout for the store-facing application. Phase 1 only: the sidebar
 * items below are navigation PLACEHOLDERS for future modules — none of them
 * are wired to real functional pages yet (see App shell routing).
 */
export function StoreAppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-brand-50">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col bg-brand-950 text-white transition-all lg:flex',
          collapsed ? 'w-[76px]' : 'w-64'
        )}
      >
        <SidebarBrand collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <SidebarItem
              key={item.to}
              to={item.to}
              label={collapsed ? '' : item.label}
              disabled={!item.enabled}
            />
          ))}
        </nav>
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-brand-950/50"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-brand-950 text-white shadow-xl">
            <SidebarBrand collapsed={false} onToggle={() => setMobileNavOpen(false)} closeIcon />
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

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarBrand({
  collapsed,
  onToggle,
  closeIcon,
}: {
  collapsed: boolean;
  onToggle: () => void;
  closeIcon?: boolean;
}) {
  return (
    <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
      {!collapsed && <span className="text-sm font-semibold tracking-wide">Clothing SaaS</span>}
      <button
        onClick={onToggle}
        className="rounded-md p-1.5 text-brand-200 hover:bg-white/10 hover:text-white"
        aria-label={closeIcon ? 'Close navigation' : 'Toggle sidebar'}
      >
        {closeIcon ? '✕' : '☰'}
      </button>
    </div>
  );
}

function TopNav({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-brand-100 bg-white px-4 sm:px-6 lg:px-8">
      <button
        onClick={onOpenMobileNav}
        className="rounded-md p-2 text-brand-600 hover:bg-brand-50 lg:hidden"
        aria-label="Open navigation"
      >
        ☰
      </button>
      <div className="hidden text-sm text-brand-500 lg:block">
        {/* Future breadcrumb / store name placeholder */}
      </div>
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-brand-200" aria-hidden="true" />
      </div>
    </header>
  );
}
