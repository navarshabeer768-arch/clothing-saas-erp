import { PageHeader, EmptyState, Card, CardBody } from '../../components/ui';

/**
 * Store dashboard placeholder. Real KPIs/widgets are built once Sales,
 * Inventory, etc. exist in later phases.
 */
export function StoreDashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Your store's overview will appear here once sales, inventory, and reporting modules are built."
      />
      <Card>
        <CardBody>
          <EmptyState
            title="Nothing to show yet"
            description="This foundation phase sets up the architecture. Business data widgets arrive in later phases."
          />
        </CardBody>
      </Card>
    </div>
  );
}
