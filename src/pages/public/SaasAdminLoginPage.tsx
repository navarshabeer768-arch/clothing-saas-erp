import { Card, CardBody, Input, Button } from '../../components/ui';

/** Placeholder SaaS admin login screen. Real auth arrives in Phase 2. */
export function SaasAdminLoginPage() {
  return (
    <Card>
      <CardBody>
        <h1 className="mb-1 text-lg font-semibold text-brand-900">SaaS Admin Sign In</h1>
        <p className="mb-6 text-sm text-brand-500">Platform administrator access.</p>
        <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
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
