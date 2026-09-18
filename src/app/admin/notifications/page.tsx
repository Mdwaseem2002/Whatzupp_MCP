'use client';

// src/app/admin/notifications/page.tsx
// Super Admin Notification Center
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckSquare, Shield, Clock, ArrowRight } from 'lucide-react';

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    async function loadNotifications() {
      try {
        const res = await fetch('/api/admin/notifications');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.notifications)) {
            setNotifications(data.notifications);
          }
        }
      } catch {
        // ignore
      }
    }
    loadNotifications();
  }, []);

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="font-[Syne] text-3xl font-bold text-gray-900 tracking-tight">
          Platform Notification Center
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Alerts for pending signup requests, tenant activity, and system governance.
        </p>
      </div>

      <div className="p-6 rounded-3xl bg-white border border-gray-200 shadow-sm space-y-4">
        {notifications.map((n) => (
          <div
            key={n.id}
            className="p-4 rounded-2xl bg-gray-50/80 border border-gray-200/80 flex items-center justify-between hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                <Bell size={18} />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  New Client Signup Request
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                    {n.type}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Reference ID: <span className="font-mono text-gray-700 font-semibold">{n.referenceId}</span> • {new Date(n.createdAt).toLocaleString()}
                </div>
              </div>
            </div>

            <Link
              href="/admin/approvals"
              className="px-4 py-2 rounded-xl bg-[#25D366] text-white font-bold text-xs hover:bg-[#20bd5a] shadow-sm transition-all flex items-center gap-1.5"
            >
              Review Request <ArrowRight size={14} />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
