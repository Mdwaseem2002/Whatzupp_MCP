'use client';

// src/app/login/page.tsx
// Login Page for WhatZupp SaaS Client & Admin Portal
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { MessageSquare, Mail, Lock, ArrowRight, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Login failed. Please verify credentials.');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Network error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminQuickFill = () => {
    setEmail('admin@whatzupp.com');
    setPassword('Pentacloud@123');
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-white flex items-center justify-center p-6 selection:bg-[#25D366] selection:text-black">
      
      {/* Background Glow */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#25D366]/10 blur-[160px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        
        {/* Header */}
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
            Client & Admin Portal Login
          </h1>
          <p className="text-gray-400 text-sm">
            Enter your credentials to access your tenant workspace.
          </p>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-2xl shadow-2xl space-y-6"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Work Email
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
                Password
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-black font-extrabold text-sm shadow-lg shadow-[#25D366]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? 'Authenticating...' : 'Sign In to Workspace'}
              {!isLoading && <ArrowRight size={16} />}
            </button>
          </form>

          {/* Quick Fill for Super Admin */}
          <div className="pt-2 border-t border-white/10 text-center space-y-2">
            <button
              type="button"
              onClick={handleAdminQuickFill}
              className="text-xs font-semibold text-[#25D366] hover:underline inline-flex items-center gap-1.5"
            >
              <ShieldCheck size={14} /> Auto-fill Super Admin Credentials
            </button>
          </div>

          <div className="text-center pt-2 text-xs text-gray-400 border-t border-white/10">
            Need an enterprise tenant account?{' '}
            <Link href="/signup" className="text-[#25D366] font-semibold hover:underline">
              Request workspace onboarding
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
