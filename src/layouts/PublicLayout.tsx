import { Outlet } from 'react-router-dom';

/** Layout for unauthenticated/public routes (login screens, etc). */
export function PublicLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
