import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody, Input, Button } from '../../components/ui';
import { saasLogin } from '../../features/auth/authService';
import { useAuth } from '../../features/auth/AuthContext';
import { AppError } from '../../lib/errors';

export function SaasAdminLoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();

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
      await saasLogin({ loginId, password });
      await refresh();
      navigate('/saas/dashboard', { replace: true });
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
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-900 text-lg font-semibold text-white">
            SA
          </div>
          <h1 className="text-lg font-semibold text-brand-900">SaaS Admin Sign In</h1>
          <p className="mt-1 text-sm text-brand-500">Platform administrator access.</p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
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
