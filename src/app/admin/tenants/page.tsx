'use client';

// src/app/admin/tenants/page.tsx
// Super Admin Tenants & Client Management
import React, { useEffect, useState } from 'react';
import { Building2, Users2, Shield, Cloud, Power, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTenants = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/tenants');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.tenants)) {
          setTenants(data.tenants);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const toggleStatus = async (tenantId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TOGGLE_STATUS',
          tenantId,
          status: newStatus,
        }),
      });
      if (res.ok) loadTenants();
    } catch {
      // ignore
    }
  };

  const deleteTenant = async (tenantId: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete tenant "${name}"?`)) return;
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE',
          tenantId,
        }),
      });
      if (res.ok) loadTenants();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="font-[Syne] text-3xl font-bold text-gray-900 tracking-tight">
          Tenants & Enterprise Clients Management
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Monitor all active client organizations, licensed workspace products, and user allocations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tenants.map((t) => (
          <div
            key={t.id}
            className="p-6 rounded-3xl bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                    {t.tenantCode}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      t.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {t.status.toUpperCase()}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mt-2">{t.name}</h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleStatus(t.id, t.status)}
                  className={`p-2.5 rounded-xl border transition-all ${
                    t.status === 'active'
                      ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
                  }`}
                  title={t.status === 'active' ? 'Disable Tenant' : 'Enable Tenant'}
                >
                  <Power size={18} />
                </button>

                <button
                  onClick={() => deleteTenant(t.id, t.name)}
                  className="p-2.5 rounded-xl border bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 transition-all cursor-pointer"
                  title="Delete Tenant"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-gray-100 text-xs text-gray-700">
              <div className="font-semibold text-gray-500">Licensed Workspace Products:</div>
              <div className="flex items-center gap-2">
                {t.tenantWorkspaces?.map((ws: any) => (
                  <span key={ws.workspaceType} className="px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-gray-800 font-mono font-bold flex items-center gap-1">
                    <Cloud size={12} className="text-[#25D366]" /> {ws.workspaceType}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-gray-100 text-xs text-gray-700">
              <div className="font-semibold text-gray-500">Active Tenant Users ({t.users?.length || 0}):</div>
              <div className="space-y-1.5">
                {t.users?.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                    <div>
                      <span className="font-bold text-gray-900">{u.fullName}</span>
                      <span className="text-gray-500 text-[11px] ml-2">({u.email})</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-gray-600 bg-gray-200/70 px-2 py-0.5 rounded">{u.role}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
