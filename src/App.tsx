import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicLayout } from './layouts/PublicLayout';
import { StoreAppLayout } from './layouts/StoreAppLayout';
import { SaasAdminLayout } from './layouts/SaasAdminLayout';
import { StoreLoginPage } from './pages/public/StoreLoginPage';
import { SaasAdminLoginPage } from './pages/public/SaasAdminLoginPage';
import { StoreDashboardPage } from './pages/store/DashboardPage';
import { ModulePlaceholderPage } from './pages/store/ModulePlaceholderPage';
import { SaasDashboardPage } from './pages/saas/SaasDashboardPage';
import { NotFoundPage } from './pages/errors/NotFoundPage';
import { ProtectedStoreRoute } from './routes/ProtectedStoreRoute';
import { ProtectedSaasRoute } from './routes/ProtectedSaasRoute';

// Future store modules get a real route + a nav entry (see StoreAppLayout)
// but only a placeholder page until their phase is built.
const FUTURE_STORE_MODULES = [
  'pos',
  'sales',
  'purchases',
  'inventory',
  'products',
  'customers',
  'suppliers',
  'expenses',
  'accounting',
  'reports',
  'administration',
];

export default function App() {
  return (
    <Routes>
      {/* Root: send visitors to the store login by default */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* ---------------------------------------------------------------- */}
      {/* Public routes                                                    */}
      {/* ---------------------------------------------------------------- */}
      <Route element={<PublicLayout />}>
        <Route path="/login" element={<StoreLoginPage />} />
        <Route path="/saas/login" element={<SaasAdminLoginPage />} />
      </Route>

      {/* ---------------------------------------------------------------- */}
      {/* Store application (protected)                                    */}
      {/* ---------------------------------------------------------------- */}
      <Route
        path="/app"
        element={
          <ProtectedStoreRoute>
            <StoreAppLayout />
          </ProtectedStoreRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<StoreDashboardPage />} />
        {FUTURE_STORE_MODULES.map((module) => (
          <Route key={module} path={module} element={<ModulePlaceholderPage />} />
        ))}
      </Route>

      {/* ---------------------------------------------------------------- */}
      {/* SaaS Admin application (protected)                               */}
      {/* ---------------------------------------------------------------- */}
      <Route
        path="/saas"
        element={
          <ProtectedSaasRoute>
            <SaasAdminLayout />
          </ProtectedSaasRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<SaasDashboardPage />} />
        {['stores', 'subscriptions', 'plans', 'users', 'settings', 'audit-logs'].map((module) => (
          <Route key={module} path={module} element={<ModulePlaceholderPage />} />
        ))}
      </Route>

      {/* ---------------------------------------------------------------- */}
      {/* 404                                                              */}
      {/* ---------------------------------------------------------------- */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
