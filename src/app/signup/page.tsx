'use client';

// src/app/signup/page.tsx
// Onboarding Signup Form for WhatZupp SaaS Enterprise
import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MessageSquare, ShieldCheck, CheckCircle2, ArrowRight, Building2, User, Mail, Phone, Lock, Cloud } from 'lucide-react';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [requestedWorkspaces, setRequestedWorkspaces] = useState<string[]>(['SFMC', 'SALES_CLOUD']);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const toggleWorkspace = (ws: string) => {
    if (requestedWorkspaces.includes(ws)) {
      if (requestedWorkspaces.length > 1) {
        setRequestedWorkspaces(requestedWorkspaces.filter(item => item !== ws));
      }
    } else {
      setRequestedWorkspaces([...requestedWorkspaces, ws]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName || !organizationName || !email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          organizationName,
          email,
          phone,
          password,
          requestedWorkspaces,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to submit signup request');
      } else {
        setIsSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-white flex items-center justify-center p-6 selection:bg-[#25D366] selection:text-black">
      
      {/* Background Glow */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#25D366]/10 blur-[160px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-xl">
        
        {/* Logo Header */}
        <div className="text-center mb-8 space-y-2">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center shadow-lg shadow-[#25D366]/20">
              <MessageSquare size={20} className="text-white" />
            </div>
            <span className="font-[Syne] font-extrabold text-2xl tracking-tight text-white">
              WhatZupp <span className="text-[#25D366] text-xs font-semibold px-2 py-0.5 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 ml-1">SaaS</span>
            </span>
          </Link>
          <h1 className="font-[Syne] text-2xl font-bold text-white pt-2">
            Request Enterprise Tenant Workspace
          </h1>
          <p className="text-gray-400 text-sm">
            Fill out your details to submit an onboarding approval request.
          </p>
        </div>

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-2xl shadow-2xl space-y-6"
        >
          {isSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#25D366]/20 border border-[#25D366]/40 text-[#25D366] flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-2xl font-bold text-white">Signup Request Submitted!</h2>
              <p className="text-gray-300 text-sm leading-relaxed max-w-md mx-auto">
                Thank you, <span className="text-[#25D366] font-semibold">{fullName}</span>. Your request for <span className="font-semibold text-white">{organizationName}</span> has been routed to our Platform Super Admin.
              </p>
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 text-xs text-gray-400 max-w-md mx-auto text-left space-y-1">
                <div className="font-semibold text-gray-200">Next Steps:</div>
                <div>1. Admin reviews organization & workspace licensing.</div>
                <div>2. Tenant workspace <span className="text-[#25D366] font-mono">{organizationName.toUpperCase().slice(0, 8)}</span> will be provisioned.</div>
                <div>3. You will receive access confirmation.</div>
              </div>
              <div className="pt-4">
                <Link
                  href="/login"
                  className="px-6 py-3 rounded-xl bg-[#25D366] text-black font-bold text-sm inline-flex items-center gap-2 hover:bg-[#20bd5a] transition-all"
                >
                  Return to Client Login <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold text-center">
                  {error}
                </div>
              )}

              {/* Full Name & Organization */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Arshad Ali"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#25D366]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Organization Name *
                  </label>
                  <div className="relative">
                    <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Pentacloud Consultancy"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#25D366]"
                    />
                  </div>
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Work Email *
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#25D366]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#25D366]"
                    />
                  </div>
                </div>
              </div>

              {/* Password & Confirm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Password *
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#25D366]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#25D366]"
                    />
                  </div>
                </div>
              </div>

              {/* Workspace Product Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-2">
                  Requested Workspace Products *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => toggleWorkspace('SFMC')}
                    className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                      requestedWorkspaces.includes('SFMC')
                        ? 'bg-[#25D366]/10 border-[#25D366] text-white'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    <Cloud size={18} className={requestedWorkspaces.includes('SFMC') ? 'text-[#25D366]' : 'text-gray-400'} />
                    <div>
                      <div className="text-xs font-bold">SFMC Workspace</div>
                      <div className="text-[10px] opacity-75">Marketing Cloud</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleWorkspace('SALES_CLOUD')}
                    className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                      requestedWorkspaces.includes('SALES_CLOUD')
                        ? 'bg-[#25D366]/10 border-[#25D366] text-white'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    <Cloud size={18} className={requestedWorkspaces.includes('SALES_CLOUD') ? 'text-[#25D366]' : 'text-gray-400'} />
                    <div>
                      <div className="text-xs font-bold">Sales Cloud</div>
                      <div className="text-[10px] opacity-75">Salesforce CRM</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-black font-extrabold text-sm shadow-lg shadow-[#25D366]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? 'Submitting Request...' : 'Submit Signup Request'}
                {!isLoading && <ArrowRight size={16} />}
              </button>
            </form>
          )}

          <div className="text-center pt-2 text-xs text-gray-400 border-t border-white/10">
            Already have an approved tenant workspace?{' '}
            <Link href="/login" className="text-[#25D366] font-semibold hover:underline">
              Log in here
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
