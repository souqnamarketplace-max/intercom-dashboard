const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'staff_access_token';

// Plain browser localStorage is fine here (unlike the resident app, which
// uses Capacitor Preferences) — this is a regular web dashboard, not a
// wrapped native app with a more aggressively-cleared WebView store.
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));

  if (res.status === 401 && auth) {
    // Token expired or was revoked — this previously surfaced as a wall of
    // "Unauthorized" errors across every screen at once, which looked
    // identical to "the backend is broken" rather than "please sign in
    // again." Clear the stale token and bounce to login instead.
    clearToken();
    localStorage.removeItem('staff_user');
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, body.message || 'Something went wrong');
  }
  return body as T;
}

// ---------- Types ----------
export interface StaffUser {
  id: string;
  email: string;
  role: 'platform_admin' | 'owner_admin' | 'owner_manager' | 'owner_staff';
  ownerId: string | null;
}
export interface Owner {
  id: string;
  name: string;
  subscriptionStatus: string;
  demoMode: boolean;
}
export interface Site {
  id: string;
  ownerId: string;
  name: string;
  address?: string;
  directoryPrivacyMode: boolean;
  brandingLogoUrl?: string | null;
  buildingInfo?: string | null;
  frontDeskResidentId?: string | null;
  frontDeskLabel?: string;
  customButtonLabels?: Record<string, string>;
  panelSettingsPin?: string;
  panelSetupCode?: string | null;
  securityTileEnabled?: boolean;
  screensaverType?: string | null;
  screensaverUrl?: string | null;
  screensaverDelaySeconds?: number;
}
export interface Unit {
  id: string;
  siteId: string;
  zoneId: string | null;
  unitNumber: string;
  residents?: Resident[];
}
export interface Zone {
  id: string;
  siteId: string;
  name: string;
  units?: Unit[];
  entryPoints?: { entryPoint: EntryPoint }[];
}
export interface Resident {
  id: string;
  unitId: string;
  name: string;
  email?: string;
  phone?: string;
  status: 'active' | 'suspended' | 'deleted';
  directoryVisible: boolean;
  inviteCode?: string;
  appAccountCreated?: boolean;
}
export interface VirtualKey {
  id: string;
  unitId: string;
  siteId: string;
  recipientName: string;
  recipientContact?: string | null;
  keyType: 'single_use' | 'recurring' | 'delivery';
  accessMethod: 'qr' | 'pin';
  status: 'active' | 'revoked' | 'expired';
  signedToken: string;
  activatesAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  rawShortCode?: string; // only present once, in the create response
}
export type PassPreset = 'custom' | 'recurring' | 'business_hours' | 'full_day';
export interface DeliveryAuthorization {
  id: string;
  siteId: string;
  carrierName: string;
  timeWindow: { openAllDay?: boolean; days?: string[]; from?: string; to?: string };
  active: boolean;
}
export interface PartnerApiKey {
  id: string;
  ownerId: string;
  name: string;
  scopes: string[];
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}
export interface PartnerApiKeyCreated extends PartnerApiKey {
  apiKey: string; // shown once
}
export interface DeviceRow {
  id: string;
  entryPointId: string;
  deviceType: 'panel' | 'pi_controller';
  serialNumber: string;
  status: string;
  connectionType: string;
  lastHeartbeatAt: string | null;
  online: boolean; // computed server-side from lastHeartbeatAt recency
  setupCode?: string | null; // only present until the device is provisioned
  provisionedAt?: string | null;
  entryPoint?: { id: string; name: string; siteId: string };
}
export interface EntryPoint {
  id: string;
  siteId: string;
  name: string;
  openToAllZones?: boolean;
}
export interface AuditEvent {
  id: string;
  siteId: string;
  eventType: string;
  method: string | null;
  result: string;
  createdAt: string;
  photoUrl: string | null;
}

export const PARTNER_API_SCOPES = [
  'read:audit_events',
  'read:residents',
  'write:residents',
  'read:devices',
  'read:units',
] as const;

// ---------- API surface ----------
export const api = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; staff: StaffUser }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      false,
    ),

  // Owners
  listOwners: () => request<Owner[]>('/owners'),
  getOwner: (id: string) => request<Owner>(`/owners/${id}`),
  createOwner: (data: { name: string }) =>
    request<Owner>('/owners', { method: 'POST', body: JSON.stringify(data) }),
  updateOwner: (id: string, data: { name?: string }) =>
    request<Owner>(`/owners/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteOwner: (id: string) => request<void>(`/owners/${id}`, { method: 'DELETE' }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean }>('/auth/change-password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // Sites — backend auto-filters by the caller's role/ownerId, no query param
  listSites: () => request<Site[]>('/sites'),
  createSite: (data: { ownerId: string; name: string; address?: string }) =>
    request<Site>('/sites', { method: 'POST', body: JSON.stringify(data) }),
  regenerateSiteSetupCode: (id: string) =>
    request<Site>(`/sites/${id}/regenerate-setup-code`, { method: 'PATCH' }),
  updateSite: (
    id: string,
    data: Partial<{
      name: string;
      address: string;
      brandingLogoUrl: string;
      buildingInfo: string;
      frontDeskResidentId: string | null;
      frontDeskLabel: string;
      customButtonLabels: Record<string, string>;
      panelSettingsPin: string;
      directoryPrivacyMode: boolean;
      securityTileEnabled: boolean;
      screensaverType: string;
      screensaverUrl: string;
      screensaverDelaySeconds: number;
    }>,
  ) => request<Site>(`/sites/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSite: (id: string) => request<void>(`/sites/${id}`, { method: 'DELETE' }),

  // Entry points
  listEntryPoints: (siteId: string) =>
    request<EntryPoint[]>(`/entry-points?siteId=${siteId}`),
  createEntryPoint: (data: { siteId: string; name: string; openToAllZones?: boolean }) =>
    request<EntryPoint>('/entry-points', { method: 'POST', body: JSON.stringify(data) }),
  updateEntryPoint: (id: string, data: { name?: string; openToAllZones?: boolean }) =>
    request<EntryPoint>(`/entry-points/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteEntryPoint: (id: string) => request<void>(`/entry-points/${id}`, { method: 'DELETE' }),

  // Devices — a panel or Pi controller belongs to exactly one entry point.
  // Online status is computed server-side from heartbeat recency.
  listDevices: (siteId: string) =>
    request<DeviceRow[]>(`/devices?siteId=${siteId}`),
  createDevice: (data: { entryPointId: string; deviceType: 'panel' | 'pi_controller'; serialNumber: string }) =>
    request<DeviceRow>('/devices', { method: 'POST', body: JSON.stringify(data) }),
  regenerateSetupCode: (id: string) =>
    request<DeviceRow>(`/devices/${id}/regenerate-setup-code`, { method: 'PATCH' }),
  deleteDevice: (id: string) => request<void>(`/devices/${id}`, { method: 'DELETE' }),

  // Units — each unit comes back with its nested `residents` array
  listUnits: (siteId: string) => request<Unit[]>(`/units?siteId=${siteId}`),
  createUnit: (data: { siteId: string; unitNumber: string }) =>
    request<Unit>('/units', { method: 'POST', body: JSON.stringify(data) }),
  updateUnit: (id: string, data: { unitNumber?: string; zoneId?: string | null }) =>
    request<Unit>(`/units/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUnit: (id: string) => request<void>(`/units/${id}`, { method: 'DELETE' }),

  // Zones
  listZones: (siteId: string) => request<Zone[]>(`/zones?siteId=${siteId}`),
  createZone: (data: { siteId: string; name: string }) =>
    request<Zone>('/zones', { method: 'POST', body: JSON.stringify(data) }),
  updateZone: (id: string, data: { name?: string }) =>
    request<Zone>(`/zones/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteZone: (id: string) => request<void>(`/zones/${id}`, { method: 'DELETE' }),
  setZoneEntryPointAccess: (zoneId: string, entryPointIds: string[]) =>
    request<Zone>(`/zones/${zoneId}/entry-points`, { method: 'PATCH', body: JSON.stringify({ entryPointIds }) }),

  // Residents — created against a unit; listing happens via listUnits' nested residents
  createResident: (data: { unitId: string; name: string; email?: string; phone?: string }) =>
    request<Resident>('/residents', { method: 'POST', body: JSON.stringify(data) }),
  suspendResident: (id: string) =>
    request<Resident>(`/residents/${id}/suspend`, { method: 'PATCH' }),
  reactivateResident: (id: string) =>
    request<Resident>(`/residents/${id}/reactivate`, { method: 'PATCH' }),
  moveOutResident: (id: string) =>
    request<Resident>(`/residents/${id}/move-out`, { method: 'PATCH' }),

  // Visitor Passes (QR) / Delivery Passes (PIN) — staff-side generation on
  // a resident's behalf, e.g. when a resident calls the front desk instead
  // of using the app themselves.
  listVirtualKeys: (unitId: string) =>
    request<VirtualKey[]>(`/virtual-keys?unitId=${unitId}`),
  createVirtualKey: (data: {
    unitId: string; siteId: string; recipientName: string; recipientContact?: string;
    keyType: 'single_use' | 'recurring' | 'delivery'; accessMethod: 'qr' | 'pin';
    preset: PassPreset;
    activatesAt?: string; expiresAt?: string;
    schedule?: { daysOfWeek: number[]; timeStart: string; timeEnd: string };
  }) => request<VirtualKey>('/virtual-keys', { method: 'POST', body: JSON.stringify(data) }),
  revokeVirtualKey: (id: string) =>
    request<VirtualKey>(`/virtual-keys/${id}/revoke`, { method: 'PATCH' }),

  // Delivery Authorizations
  listDeliveryAuthorizations: (siteId: string) =>
    request<DeliveryAuthorization[]>(`/delivery-authorizations?siteId=${siteId}`),
  createDeliveryAuthorization: (data: {
    siteId: string;
    carrierName: string;
    rawPin: string;
    timeWindow?: Record<string, any>;
  }) =>
    request<DeliveryAuthorization>('/delivery-authorizations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateDeliveryAuthorization: (id: string, data: Partial<{ active: boolean; rawPin: string }>) =>
    request<DeliveryAuthorization>(`/delivery-authorizations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteDeliveryAuthorization: (id: string) =>
    request<void>(`/delivery-authorizations/${id}`, { method: 'DELETE' }),

  // Partner API Keys
  listPartnerApiKeys: (ownerId: string) =>
    request<PartnerApiKey[]>(`/partner-api-keys?ownerId=${ownerId}`),
  createPartnerApiKey: (data: { ownerId: string; name: string; scopes: string[] }) =>
    request<PartnerApiKeyCreated>('/partner-api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  revokePartnerApiKey: (id: string) =>
    request<PartnerApiKey>(`/partner-api-keys/${id}`, { method: 'DELETE' }),

  // Audit events
  listAuditEvents: (siteId: string, cursor?: string) =>
    request<{ events: AuditEvent[]; nextCursor: string | null }>(
      `/audit-events?siteId=${siteId}${cursor ? `&cursor=${cursor}` : ''}`,
    ),
};

export { API_URL };
