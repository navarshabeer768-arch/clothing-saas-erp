import { Card, CardBody, Input, Button } from '../../components/ui';

/**
 * Placeholder store-user login screen. The real authentication workflow
 * (Store ID + Login ID + Password → trusted server endpoint) is built in
 * Phase 2. This page exists now only so routing/layout can be validated.
 */
export function StoreLoginPage() {
  return (
    <Card>
      <CardBody>
        <h1 className="mb-1 text-lg font-semibold text-brand-900">Store Sign In</h1>
        <p className="mb-6 text-sm text-brand-500">
          Sign in with your Store ID, Login ID, and Password.
        </p>
        <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
          <Input label="Store ID" placeholder="STORE-0001" autoComplete="off" disabled />
          <Input label="Login ID" placeholder="admin" autoComplete="off" disabled />
          <Input label="Password" type="password" placeholder="••••••••" disabled />
          <Button type="submit" disabled>
            Sign In (available in Phase 2)
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
