import { useLocation } from 'react-router-dom';
import { PageHeader, EmptyState, Card, CardBody } from '../../components/ui';

/**
 * Generic "coming soon" placeholder for future store modules (Products,
 * Inventory, POS, Sales, etc). Keeps routing structure real without
 * building fake functional pages ahead of schedule.
 */
export function ModulePlaceholderPage() {
  const { pathname } = useLocation();
  const moduleName = pathname.split('/').filter(Boolean).pop() ?? 'module';
  const label = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);

  return (
    <div>
      <PageHeader title={label} />
      <Card>
        <CardBody>
          <EmptyState
            title={`${label} is coming in a later phase`}
            description="This route exists as part of the Phase 1 navigation foundation. The functional module isn't built yet."
          />
        </CardBody>
      </Card>
    </div>
  );
}
