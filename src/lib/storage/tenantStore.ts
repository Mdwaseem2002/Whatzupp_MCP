// src/lib/storage/tenantStore.ts
import fs from 'fs';
import path from 'path';
import { getLocalSignupRequests } from './signupStore';

export interface LocalTenant {
  id: string;
  name: string;
  tenantCode: string;
  status: 'active' | 'inactive';
  createdAt: string;
  tenantWorkspaces: { workspaceType: string }[];
  users: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    status: string;
  }[];
}

const DATA_DIR = path.resolve(process.cwd(), 'src', 'data');
const TENANTS_FILE = path.join(DATA_DIR, 'tenants.json');
const DELETED_TENANTS_FILE = path.join(DATA_DIR, 'deleted_tenants.json');

function ensureDataDirExists() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {}
}

export function getDeletedTenantCodes(): string[] {
  ensureDataDirExists();
  if (fs.existsSync(DELETED_TENANTS_FILE)) {
    try {
      const content = fs.readFileSync(DELETED_TENANTS_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

export function getLocalTenants(): LocalTenant[] {
  ensureDataDirExists();
  let fileTenants: LocalTenant[] = [];
  if (fs.existsSync(TENANTS_FILE)) {
    try {
      const content = fs.readFileSync(TENANTS_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) fileTenants = parsed;
    } catch {}
  }

  // Derive active tenants from approved signup requests
  const signups = getLocalSignupRequests();
  const approvedSignups = signups.filter(s => s.status === 'APPROVED');

  const derivedTenants: LocalTenant[] = approvedSignups.map(s => {
    const code = (s.organizationName || 'TENANT').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    return {
      id: `t-${s.id}`,
      name: s.organizationName || `${s.fullName}'s Organization`,
      tenantCode: code,
      status: 'active',
      createdAt: s.createdAt || new Date().toISOString(),
      tenantWorkspaces: (s.requestedWorkspaces || ['SFMC', 'SALES_CLOUD']).map(w => ({ workspaceType: w })),
      users: [
        {
          id: `u-${s.id}`,
          fullName: s.fullName,
          email: s.email,
          role: 'TENANT_ADMIN',
          status: 'active',
        },
      ],
    };
  });

  // Merge cleanly by tenantCode
  const tenantMap = new Map<string, LocalTenant>();

  // Add derived tenants from approved signups
  for (const t of derivedTenants) {
    tenantMap.set(t.tenantCode, t);
  }

  // Add custom created tenants from file
  for (const t of fileTenants) {
    tenantMap.set(t.tenantCode, t);
  }

  const deletedCodes = getDeletedTenantCodes();

  return Array.from(tenantMap.values()).filter(t =>
    !deletedCodes.includes(t.tenantCode) && !deletedCodes.includes(t.id)
  );
}

export function saveLocalTenant(tenant: LocalTenant): void {
  ensureDataDirExists();
  const current = getLocalTenants();
  const index = current.findIndex(t => t.tenantCode === tenant.tenantCode || t.id === tenant.id);
  if (index >= 0) {
    current[index] = { ...current[index], ...tenant };
  } else {
    current.unshift(tenant);
  }
  try {
    fs.writeFileSync(TENANTS_FILE, JSON.stringify(current, null, 2), 'utf8');
  } catch {}
}

export function toggleLocalTenantStatus(tenantId: string, status: 'active' | 'inactive'): void {
  ensureDataDirExists();
  const current = getLocalTenants();
  const target = current.find(t => t.id === tenantId || t.tenantCode === tenantId);
  if (target) {
    target.status = status;
    saveLocalTenant(target);
  }
}

export function deleteLocalTenant(tenantIdOrCode: string): boolean {
  ensureDataDirExists();
  const current = getLocalTenants();
  const target = current.find(t => t.id === tenantIdOrCode || t.tenantCode === tenantIdOrCode);
  const codeToDelete = target?.tenantCode || tenantIdOrCode;

  const deletedCodes = getDeletedTenantCodes();
  if (!deletedCodes.includes(codeToDelete)) {
    deletedCodes.push(codeToDelete);
    if (target?.id && !deletedCodes.includes(target.id)) {
      deletedCodes.push(target.id);
    }
    try {
      fs.writeFileSync(DELETED_TENANTS_FILE, JSON.stringify(deletedCodes, null, 2), 'utf8');
    } catch {}
  }

  if (fs.existsSync(TENANTS_FILE)) {
    try {
      const content = fs.readFileSync(TENANTS_FILE, 'utf8');
      const parsed: LocalTenant[] = JSON.parse(content);
      const filtered = parsed.filter(t => t.id !== tenantIdOrCode && t.tenantCode !== codeToDelete);
      fs.writeFileSync(TENANTS_FILE, JSON.stringify(filtered, null, 2), 'utf8');
    } catch {}
  }

  return true;
}
