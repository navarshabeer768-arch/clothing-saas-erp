import { PageHeader, EmptyState, Card, CardBody } from '../../components/ui';

/** SaaS admin dashboard placeholder. */
export function SaasDashboardPage() {
  return (
    <div>
      <PageHeader
        title="Platform Dashboard"
        description="Store counts, subscription health, and platform metrics will appear here in later phases."
      />
      <Card>
        <CardBody>
          <EmptyState
            title="Nothing to show yet"
            description="Store management, subscriptions, and plans are built in upcoming phases."
          />
        </CardBody>
      </Card>
    </div>
  );
}
