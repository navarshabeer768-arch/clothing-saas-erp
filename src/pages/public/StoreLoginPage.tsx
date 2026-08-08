import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardBody, Input, Button } from '../../components/ui';
import { storeLogin } from '../../features/auth/authService';
import { useAuth } from '../../features/auth/AuthContext';
import { AppError } from '../../lib/errors';

interface LocationState {
  from?: string;
}

export function StoreLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useAuth();

  const [storeId, setStoreId] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await storeLogin({ storeId, loginId, password });
      // Re-derive auth state from the server rather than trusting the
      // login response alone -- keeps AuthContext as the single source of
      // truth fed only by the session endpoint.
      await refresh();
      const from = (location.state as LocationState | null)?.from;
      navigate(from && from.startsWith('/app') ? from : '/app/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof AppError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardBody>
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-800 text-lg font-semibold text-white">
            CS
          </div>
          <h1 className="text-lg font-semibold text-brand-900">Store Sign In</h1>
          <p className="mt-1 text-sm text-brand-500">Sign in with your Store ID, Login ID, and Password.</p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input
            label="Store ID"
            placeholder="STORE-0001"
            autoComplete="off"
            autoCapitalize="characters"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            required
          />
          <Input
            label="Login ID"
            placeholder="admin"
            autoComplete="username"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            required
          />
          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="********"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pr-16"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-[34px] text-xs font-medium text-brand-500 hover:text-brand-700"
              tabIndex={-1}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button type="submit" isLoading={isSubmitting} className="mt-1">
            Sign In
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
