import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-brand-200 bg-white px-6 py-12 text-center">
      {icon && <div className="mb-3 text-brand-300">{icon}</div>}
      <p className="text-sm font-medium text-brand-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-brand-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
