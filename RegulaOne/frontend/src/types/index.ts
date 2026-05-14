export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER';

export interface Tenant {
  id: string;
  name: string;
  taxId?: string;
  status: 'active' | 'suspended';
  subscriptionTier: 'Basic' | 'Pro' | 'Enterprise';
  enabledModules: string[];
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  tenantId?: string;
  displayName?: string;
  status: 'active' | 'suspended';
}

export interface AuditLog {
  id: string;
  userId: string;
  tenantId: string;
  action: string;
  entity: string;
  details: string;
  timestamp: Date;
}
