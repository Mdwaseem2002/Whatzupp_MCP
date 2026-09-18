'use client';

// src/app/admin/approvals/page.tsx
// Super Admin Signup Approval Queue, Edit Licenses & Tenant Control - White Theme
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check, X, Edit3, Trash2, Shield, Building2, Cloud, User, Mail, Phone, AlertCircle, CheckCircle2, Clock
} from 'lucide-react';

export default function AdminApprovalsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState<any | null>(null);
  const [modalType, setModalType] = useState<'APPROVE' | 'REJECT' | 'EDIT' | 'DELETE' | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [tenantCode, setTenantCode] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [licensedWorkspaces, setLicensedWorkspaces] = useState<string[]>(['SFMC', 'SALES_CLOUD']);
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [rejectedReason, setRejectedReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', msg: '' });

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/approvals');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.requests)) {
          setRequests(data.requests);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const openApproveModal = (req: any) => {
    setSelectedReq(req);
    setFullName(req.fullName || '');
    setEmail(req.email || '');
    setOrganizationName(req.organizationName || `${req.fullName}'s Enterprise`);
    const code = (req.organizationName || 'TENANT').toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 15);
    setTenantCode(code);
    setLicensedWorkspaces(req.requestedWorkspaces?.length ? req.requestedWorkspaces : ['SFMC', 'SALES_CLOUD']);
    setModalType('APPROVE');
  };

  const openEditModal = (req: any) => {
    setSelectedReq(req);
    setFullName(req.fullName || '');
    setEmail(req.email || '');
    setOrganizationName(req.organizationName || `${req.fullName}'s Enterprise`);
    setLicensedWorkspaces(req.requestedWorkspaces?.length ? req.requestedWorkspaces : ['SALES_CLOUD']);
    setStatus(req.status || 'APPROVED');
    setModalType('EDIT');
  };

  const openRejectModal = (req: any) => {
    setSelectedReq(req);
    setRejectedReason('');
    setModalType('REJECT');
  };

  const openDeleteModal = (req: any) => {
    setSelectedReq(req);
    setModalType('DELETE');
  };

  const handleAction = async () => {
    if (!selectedReq || !modalType) return;
    setIsSubmitting(true);
    setFeedback({ type: '', msg: '' });

    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: modalType,
          requestId: selectedReq.id,
          fullName: modalType === 'EDIT' ? fullName : undefined,
          email: modalType === 'EDIT' ? email : undefined,
          status: modalType === 'EDIT' ? status : undefined,
          tenantCode: modalType === 'APPROVE' ? tenantCode : undefined,
          organizationName: modalType === 'APPROVE' || modalType === 'EDIT' ? organizationName : undefined,
          licensedWorkspaces: modalType === 'APPROVE' || modalType === 'EDIT' ? licensedWorkspaces : undefined,
          role: 'TENANT_ADMIN',
          rejectedReason: modalType === 'REJECT' ? rejectedReason : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({ type: 'error', msg: data.error || 'Action failed' });
      } else {
        setFeedback({ type: 'success', msg: data.message });
        setTimeout(() => {
          setModalType(null);
          setSelectedReq(null);
          loadRequests();
        }, 1000);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message || 'Network error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleWorkspaceLicense = (ws: string) => {
    if (licensedWorkspaces.includes(ws)) {
      if (licensedWorkspaces.length > 1) {
        setLicensedWorkspaces(licensedWorkspaces.filter(w => w !== ws));
      }
    } else {
      setLicensedWorkspaces([...licensedWorkspaces, ws]);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl font-sans">
      
      <div>
        <h1 className="font-[Syne] text-3xl font-bold text-gray-900 tracking-tight">
          Client Onboarding & Signup Approval Queue
        </h1>
        <p className="text-gray-500 text-sm mt-1 font-medium">
          Approve pending requests, edit organization licenses (SFMC / Sales Cloud), and manage tenant access.
        </p>
      </div>

      {/* Requests Table */}
      <div className="p-6 rounded-3xl bg-white border border-gray-200 shadow-sm space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 uppercase tracking-wider font-bold">
                <th className="py-3 px-3">Applicant Name</th>
                <th className="py-3 px-3">Organization</th>
                <th className="py-3 px-3">Contact</th>
                <th className="py-3 px-3">Licensed Workspaces</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-3 font-bold text-gray-900">
                    {req.fullName}
                  </td>
                  <td className="py-4 px-3 font-bold text-gray-700">
                    {req.organizationName || 'Client Org'}
                  </td>
                  <td className="py-4 px-3 text-gray-600">
                    <div>{req.email}</div>
                    <div className="text-[10px] text-gray-400 font-medium">{req.phone || 'No phone'}</div>
                  </td>
                  <td className="py-4 px-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {req.requestedWorkspaces?.map((w: string) => (
                        <span key={w} className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-mono font-bold border border-emerald-200">
                          {w}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-3">
                    {req.status === 'PENDING' && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200 flex items-center gap-1 w-fit">
                        <Clock size={10} /> PENDING
                      </span>
                    )}
                    {req.status === 'APPROVED' && (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 flex items-center gap-1 w-fit">
                        <CheckCircle2 size={10} /> APPROVED
                      </span>
                    )}
                    {req.status === 'REJECTED' && (
                      <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200 flex items-center gap-1 w-fit">
                        <X size={10} /> REJECTED
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {req.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => openApproveModal(req)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-[11px] flex items-center gap-1 shadow-sm"
                            title="Approve and provision tenant"
                          >
                            <Check size={13} /> Approve
                          </button>
                          <button
                            onClick={() => openRejectModal(req)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-[11px] flex items-center gap-1"
                            title="Reject request"
                          >
                            <X size={13} /> Reject
                          </button>
                        </>
                      )}

                      {/* Edit Licenses & Details button available for ALL rows */}
                      <button
                        onClick={() => openEditModal(req)}
                        className="px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 font-bold text-[11px] flex items-center gap-1"
                        title="Edit workspace licenses (SFMC / Sales Cloud) & details"
                      >
                        <Edit3 size={13} className="text-amber-600" /> Edit & Licenses
                      </button>

                      {/* Delete button available for ALL rows */}
                      <button
                        onClick={() => openDeleteModal(req)}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-[11px]"
                        title="Delete request"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog */}
      {modalType && selectedReq && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-white border border-gray-200 rounded-3xl p-6 space-y-6 shadow-2xl text-gray-900"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                {modalType === 'APPROVE' && (
                  <>
                    <CheckCircle2 size={20} className="text-emerald-600" /> Approve & Create Tenant
                  </>
                )}
                {modalType === 'EDIT' && (
                  <>
                    <Edit3 size={20} className="text-amber-600" /> Edit Details & Workspace Licenses
                  </>
                )}
                {modalType === 'REJECT' && (
                  <>
                    <AlertCircle size={20} className="text-rose-600" /> Reject Signup Request
                  </>
                )}
                {modalType === 'DELETE' && (
                  <>
                    <Trash2 size={20} className="text-rose-600" /> Delete Request
                  </>
                )}
              </h3>
              <button
                onClick={() => setModalType(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            {feedback.msg && (
              <div
                className={`p-3 rounded-xl text-xs font-bold ${
                  feedback.type === 'error'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {feedback.msg}
              </div>
            )}

            {modalType === 'APPROVE' && (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-gray-600 mb-1 font-bold">Tenant Code (Unique Key)</label>
                  <input
                    type="text"
                    value={tenantCode}
                    onChange={(e) => setTenantCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 font-mono text-xs focus:border-[#25D366] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-600 mb-1 font-bold">Organization / Client Name</label>
                  <input
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-xs focus:border-[#25D366] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-600 mb-2 font-bold">Licensed Workspaces (Purchased Products)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => toggleWorkspaceLicense('SFMC')}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between ${
                        licensedWorkspaces.includes('SFMC')
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                          : 'bg-gray-50 border-gray-200 text-gray-500'
                      }`}
                    >
                      <span className="font-bold">SFMC Workspace</span>
                      {licensedWorkspaces.includes('SFMC') && <Check size={14} className="text-emerald-600" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleWorkspaceLicense('SALES_CLOUD')}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between ${
                        licensedWorkspaces.includes('SALES_CLOUD')
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                          : 'bg-gray-50 border-gray-200 text-gray-500'
                      }`}
                    >
                      <span className="font-bold">Sales Cloud CRM</span>
                      {licensedWorkspaces.includes('SALES_CLOUD') && <Check size={14} className="text-emerald-600" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {modalType === 'EDIT' && (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-gray-600 mb-1 font-bold">Applicant Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-xs focus:border-[#25D366] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-600 mb-1 font-bold">Work Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-xs focus:border-[#25D366] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-600 mb-1 font-bold">Organization Name</label>
                  <input
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-xs focus:border-[#25D366] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-600 mb-1 font-bold">Account Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-xs focus:border-[#25D366] focus:outline-none font-bold"
                  >
                    <option value="APPROVED">APPROVED (Active)</option>
                    <option value="PENDING">PENDING (Review required)</option>
                    <option value="REJECTED">REJECTED (Access blocked)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-600 mb-2 font-bold">Toggle Workspace Licenses (SFMC vs Sales Cloud)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => toggleWorkspaceLicense('SFMC')}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between ${
                        licensedWorkspaces.includes('SFMC')
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                          : 'bg-gray-50 border-gray-200 text-gray-500'
                      }`}
                    >
                      <span className="font-bold">SFMC Workspace</span>
                      {licensedWorkspaces.includes('SFMC') && <Check size={14} className="text-emerald-600" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleWorkspaceLicense('SALES_CLOUD')}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between ${
                        licensedWorkspaces.includes('SALES_CLOUD')
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                          : 'bg-gray-50 border-gray-200 text-gray-500'
                      }`}
                    >
                      <span className="font-bold">Sales Cloud CRM</span>
                      {licensedWorkspaces.includes('SALES_CLOUD') && <Check size={14} className="text-emerald-600" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {modalType === 'REJECT' && (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-gray-600 mb-1 font-bold">Rejection Reason</label>
                  <textarea
                    rows={3}
                    placeholder="Enter reason for rejecting signup..."
                    value={rejectedReason}
                    onChange={(e) => setRejectedReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-xs focus:border-rose-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {modalType === 'DELETE' && (
              <div className="space-y-3 text-xs">
                <p className="text-gray-700">
                  Are you sure you want to permanently delete the request for <strong className="text-gray-900">{selectedReq.fullName}</strong> (<span className="text-gray-500">{selectedReq.email}</span>)?
                </p>
                <p className="text-rose-600 font-bold text-[11px]">This action cannot be undone.</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                onClick={() => setModalType(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={isSubmitting}
                className={`px-5 py-2 rounded-xl font-bold text-xs shadow-sm ${
                  modalType === 'DELETE'
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : modalType === 'REJECT'
                    ? 'bg-rose-500 text-white hover:bg-rose-600'
                    : 'bg-[#25D366] text-white hover:bg-[#20bd5a]'
                }`}
              >
                {isSubmitting
                  ? 'Processing...'
                  : modalType === 'EDIT'
                  ? 'Save Workspace Licenses'
                  : modalType === 'DELETE'
                  ? 'Delete Request'
                  : modalType === 'APPROVE'
                  ? 'Confirm Approval'
                  : 'Confirm Rejection'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
