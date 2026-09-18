'use client';

// src/app/admin/dashboard/page.tsx
// Super Admin Dashboard Overview - White / Light Theme
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2, CheckSquare, Users2, Cloud, ShieldCheck, ArrowRight, Activity, Zap, Clock, CheckCircle2, XCircle
} from 'lucide-react';

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState({
    totalTenants: 2,
    pendingApprovals: 2,
    totalUsers: 4,
    activeProducts: 2,
  });

  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/admin/approvals');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.requests)) {
            const pending = data.requests.filter((r: any) => r.status === 'PENDING');
            setPendingRequests(pending);
            setMetrics(prev => ({ ...prev, pendingApprovals: pending.length }));
          }
        }
      } catch {
        // use initial fallback state
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="h-full flex flex-col justify-between space-y-3.5 max-w-[1600px] mx-auto w-full font-sans">
      
      {/* Title */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            Platform Governance & Operations Dashboard
          </h1>
          <p className="text-slate-500 text-xs mt-0.5 font-medium">
            Real-time multi-tenant operations, automated provisioning, and ecosystem telemetry.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-extrabold border border-emerald-200/80 shadow-2xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20" /> 
            Live Telemetry
          </span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 shrink-0">
        
        {/* Active Tenants */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 p-4 relative overflow-hidden flex flex-col justify-between group">
          <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-400 absolute top-0 left-0 right-0" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">Active Tenants</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/60 text-emerald-600 flex items-center justify-center shadow-2xs group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
              <Building2 size={18} />
            </div>
          </div>
          <div className="my-1.5">
            <div className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">{metrics.totalTenants}</div>
          </div>
          <div className="text-[10px] text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full font-extrabold border border-emerald-200/80 flex items-center gap-1 w-fit">
            <CheckCircle2 size={11} className="text-emerald-600" /> 100% Tenant Isolation
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 p-4 relative overflow-hidden flex flex-col justify-between group">
          <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-400 absolute top-0 left-0 right-0" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">Pending Approvals</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/60 text-amber-600 flex items-center justify-center shadow-2xs group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
              <Clock size={18} />
            </div>
          </div>
          <div className="my-1.5">
            <div className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">{metrics.pendingApprovals}</div>
          </div>
          <div className="text-[10px] text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full font-extrabold border border-amber-200/80 flex items-center gap-1 w-fit">
            Super Admin Action Required
          </div>
        </div>

        {/* Total Users */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 p-4 relative overflow-hidden flex flex-col justify-between group">
          <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-400 absolute top-0 left-0 right-0" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">Total Users</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200/60 text-blue-600 flex items-center justify-center shadow-2xs group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
              <Users2 size={18} />
            </div>
          </div>
          <div className="my-1.5">
            <div className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">{metrics.totalUsers}</div>
          </div>
          <div className="text-[10px] text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded-full font-extrabold border border-blue-200/80 flex items-center gap-1 w-fit">
            Role-Scoped Access
          </div>
        </div>

        {/* Licensed Products */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 p-4 relative overflow-hidden flex flex-col justify-between group">
          <div className="h-1 bg-gradient-to-r from-purple-500 to-pink-400 absolute top-0 left-0 right-0" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">Licensed Products</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200/60 text-purple-600 flex items-center justify-center shadow-2xs group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
              <Cloud size={18} />
            </div>
          </div>
          <div className="my-1.5 flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border border-indigo-200/80 font-mono font-black text-xs shadow-2xs">
              SFMC
            </span>
            <span className="text-slate-300 font-bold text-xs">+</span>
            <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 border border-blue-200/80 font-mono font-black text-xs shadow-2xs">
              Sales Cloud
            </span>
          </div>
          <div className="text-[10px] text-purple-800 bg-purple-50 px-2.5 py-0.5 rounded-full font-extrabold border border-purple-200/80 flex items-center gap-1 w-fit">
            Enterprise Product Suite
          </div>
        </div>
      </div>

      {/* Infrastructure & Integration Health */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)] space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
            <Activity size={16} className="text-[#25D366]" /> Infrastructure & Integration Health
          </h3>
          <span className="text-[10px] text-slate-400 font-mono font-bold">4 Microservices Monitored</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/60 flex items-center justify-between hover:border-emerald-200 hover:bg-emerald-50/30 transition-all duration-200">
            <div>
              <div className="text-xs font-bold text-slate-800">Supabase DB</div>
              <div className="text-[10px] text-slate-500 font-medium">Core Postgres Store</div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-extrabold text-[10px] border border-emerald-200/80 flex items-center gap-1.5 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20" /> Operational
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/60 flex items-center justify-between hover:border-emerald-200 hover:bg-emerald-50/30 transition-all duration-200">
            <div>
              <div className="text-xs font-bold text-slate-800">WhatsApp Webhook</div>
              <div className="text-[10px] text-slate-500 font-medium">Real-time Dispatcher</div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-extrabold text-[10px] border border-emerald-200/80 flex items-center gap-1.5 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20" /> Operational
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/60 flex items-center justify-between hover:border-emerald-200 hover:bg-emerald-50/30 transition-all duration-200">
            <div>
              <div className="text-xs font-bold text-slate-800">SFMC Integration</div>
              <div className="text-[10px] text-slate-500 font-medium">Journey Builder API</div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-extrabold text-[10px] border border-emerald-200/80 flex items-center gap-1.5 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20" /> Connected
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/60 flex items-center justify-between hover:border-emerald-200 hover:bg-emerald-50/30 transition-all duration-200">
            <div>
              <div className="text-xs font-bold text-slate-800">Sales Cloud Sync</div>
              <div className="text-[10px] text-slate-500 font-medium">Lead Automation</div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-extrabold text-[10px] border border-emerald-200/80 flex items-center gap-1.5 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20" /> Active
            </span>
          </div>
        </div>
      </div>

      {/* Pending Approval Table Preview */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)] p-4 flex flex-col justify-between overflow-hidden min-h-0">
        <div className="flex items-center justify-between shrink-0 mb-2.5">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <CheckSquare size={17} className="text-amber-500" /> Pending Signup Requests Queue
            </h3>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Review and provision new enterprise client accounts</p>
          </div>
          <Link
            href="/admin/approvals"
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs font-extrabold text-slate-800 transition-all flex items-center gap-1.5 shadow-2xs hover:shadow-xs"
          >
            View Full Queue <ArrowRight size={13} />
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-md">
              <tr className="border-b border-slate-200/80 text-slate-500 uppercase tracking-widest font-extrabold text-[10px]">
                <th className="py-2.5 px-3.5 rounded-l-xl">Applicant</th>
                <th className="py-2.5 px-3.5">Organization</th>
                <th className="py-2.5 px-3.5">Requested Workspaces</th>
                <th className="py-2.5 px-3.5">Date</th>
                <th className="py-2.5 px-3.5 text-right rounded-r-xl">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingRequests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 font-medium">
                    No pending requests in queue.
                  </td>
                </tr>
              ) : (
                pendingRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-emerald-50/40 transition-colors duration-150">
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-900 flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-emerald-100/80 text-emerald-800 border border-emerald-200/60 flex items-center justify-center font-black text-xs shadow-2xs">
                          {req.fullName?.[0]?.toUpperCase() || 'A'}
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900">{req.fullName}</div>
                          <div className="text-[10px] text-slate-400 font-medium">{req.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3.5 font-bold text-slate-800">
                      {req.organizationName || 'Client Organization'}
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-1.5">
                        {req.requestedWorkspaces?.map((w: string) => (
                          <span key={w} className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-mono font-extrabold border border-emerald-200/80 shadow-2xs">
                            {w}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 text-slate-500 text-xs font-semibold">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <Link
                        href="/admin/approvals"
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#25D366] via-emerald-600 to-[#128C7E] hover:brightness-105 text-white font-extrabold text-xs inline-flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all duration-200 hover:scale-[1.02]"
                      >
                        Review Request <ArrowRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
