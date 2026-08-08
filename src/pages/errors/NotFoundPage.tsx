import { Link } from 'react-router-dom';
import { Button } from '../../components/ui';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-brand-50 px-6 text-center">
      <p className="text-sm font-medium text-brand-400">404</p>
      <h1 className="text-lg font-semibold text-brand-900">Page not found</h1>
      <p className="max-w-sm text-sm text-brand-500">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Link to="/">
        <Button className="mt-2">Go home</Button>
      </Link>
    </div>
  );
}
