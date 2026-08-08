import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/cn';

export interface SidebarItemProps {
  to: string;
  icon?: ReactNode;
  label: string;
  disabled?: boolean;
  end?: boolean;
}

/** Single navigation entry used by both the Store and SaaS sidebars. */
export function SidebarItem({ to, icon, label, disabled, end }: SidebarItemProps) {
  if (disabled) {
    return (
      <div
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-brand-300 cursor-not-allowed"
        title="Coming soon"
      >
        {icon}
        <span>{label}</span>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-brand-300">Soon</span>
      </div>
    );
  }

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'bg-brand-800 text-white' : 'text-brand-200 hover:bg-brand-800/60 hover:text-white'
        )
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}
