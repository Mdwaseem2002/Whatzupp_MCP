'use client';

// src/app/admin/audit/page.tsx
// Super Admin Audit Log Viewer
import React, { useEffect, useState } from 'react';
import { FileText, Shield, User, Clock, Building2 } from 'lucide-react';

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    async function loadLogs() {
      try {
        const res = await fetch('/api/admin/audit');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.logs)) {
            setLogs(data.logs);
          }
        }
      } catch {
        // ignore
      }
    }
    loadLogs();
  }, []);

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="font-[Syne] text-3xl font-bold text-gray-900 tracking-tight">
          Platform Security Audit Log
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Complete, unalterable audit trail of tenant approvals, permission modifications, and governance actions.
        </p>
      </div>

      <div className="p-6 rounded-3xl bg-white border border-gray-200 shadow-sm space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 uppercase tracking-wider font-semibold bg-gray-50/50">
                <th className="py-3 px-4 rounded-l-xl">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Tenant Scope</th>
                <th className="py-3 px-4">Performed By</th>
                <th className="py-3 px-4 rounded-r-xl">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="py-3.5 px-4 text-gray-600 font-mono">
                    {new Date(l.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 font-mono font-bold text-[10px] border border-emerald-200">
                      {l.action}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-gray-800 font-semibold">
                    {l.tenant?.name ? (
                      <span className="flex items-center gap-1">
                        <Building2 size={12} className="text-gray-400" /> {l.tenant.name}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">Platform Level</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-gray-800 font-medium">
                    {l.performer?.fullName || l.user?.fullName || 'Super Admin'}
                  </td>
                  <td className="py-3.5 px-4 text-gray-500 font-mono text-[11px]">
                    {l.details ? JSON.stringify(l.details) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
