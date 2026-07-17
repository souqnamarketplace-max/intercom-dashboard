import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { SiteProvider } from './auth/SiteContext';
import AppLayout from './layout/AppLayout';
import Login from './screens/Login';
import Owners from './screens/Owners';
import Sites from './screens/Sites';
import UnitsZones from './screens/UnitsZones';
import Devices from './screens/Devices';
import BrandingSettings from './screens/BrandingSettings';
import DeliveryAuthorizations from './screens/DeliveryAuthorizations';
import PartnerApiKeys from './screens/PartnerApiKeys';
import AuditTrail from './screens/AuditTrail';
import Account from './screens/Account';

function ProtectedShell() {
  const { staff } = useAuth();
  if (!staff) return <Navigate to="/login" replace />;
  return (
    <SiteProvider>
      <AppLayout />
    </SiteProvider>
  );
}

function RequirePlatformAdmin({ children }: { children: ReactNode }) {
  const { staff } = useAuth();
  if (staff?.role !== 'platform_admin') return <Navigate to="/sites" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedShell />}>
            <Route index element={<Navigate to="/sites" replace />} />
            <Route path="owners" element={<RequirePlatformAdmin><Owners /></RequirePlatformAdmin>} />
            <Route path="sites" element={<Sites />} />
            <Route path="units" element={<UnitsZones />} />
            <Route path="devices" element={<Devices />} />
            <Route path="branding-settings" element={<BrandingSettings />} />
            <Route path="delivery-authorizations" element={<DeliveryAuthorizations />} />
            <Route path="partner-api-keys" element={<PartnerApiKeys />} />
            <Route path="audit-trail" element={<AuditTrail />} />
            <Route path="account" element={<Account />} />
          </Route>
          <Route path="*" element={<Navigate to="/sites" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
