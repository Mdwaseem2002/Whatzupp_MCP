'use client';

// src/components/app/SettingsView.tsx
// Settings: profile edit, workspace management, WhatsApp API config, appearance
// Redesigned: WhatsApp-green theme (#25D366), clean SaaS layout

import React, { useState } from 'react';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { WORKSPACE_COLORS, LABEL_COLORS, LabelColor } from '@/types/workspace';
import { motion } from 'framer-motion';
import {
  User, Building2, Smartphone, Palette, Check, Plus, Trash2,
  Globe, Briefcase, Users2, ShoppingBag, Zap, Loader2,
  Mail, Phone, Shield, ExternalLink, Settings, ChevronRight, Tag
} from 'lucide-react';

const ICON_OPTIONS = ['Building2', 'Briefcase', 'Globe', 'Users2', 'ShoppingBag', 'Zap'];

const renderIcon = (name: string, props: any = { size: 16 }) => {
  switch (name) {
    case 'Building2': return <Building2 {...props} />;
    case 'Briefcase': return <Briefcase {...props} />;
    case 'Globe': return <Globe {...props} />;
    case 'Users2': return <Users2 {...props} />;
    case 'ShoppingBag': return <ShoppingBag {...props} />;
    case 'Zap': return <Zap {...props} />;
    default: return <Building2 {...props} />;
  }
};

export default function SettingsView() {
  const [activeSection, setActiveSection] = useState<'profile' | 'workspaces' | 'whatsapp' | 'theme' | 'labels'>('profile');

  const sections = [
    { key: 'profile' as const, label: 'Profile', icon: <User size={18} />, description: 'Personal info' },
    { key: 'workspaces' as const, label: 'Workspaces', icon: <Building2 size={18} />, description: 'Manage teams' },
    { key: 'labels' as const, label: 'Chat Labels', icon: <Tag size={18} />, description: 'Organize chats' },
    { key: 'whatsapp' as const, label: 'WhatsApp API', icon: <Smartphone size={18} />, description: 'API credentials' },
    { key: 'theme' as const, label: 'Appearance', icon: <Palette size={18} />, description: 'UI preferences' },
  ];

  return (
    <div className="flex-1 overflow-hidden bg-[#F8FAFC] flex flex-col md:flex-row" style={{ fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
      
      {/* ─── Settings Sidebar ─── */}
      <div className="w-full md:w-[260px] bg-white border-r border-gray-200 p-5 shrink-0 md:min-h-full overflow-y-auto">
        <div className="flex items-center gap-2.5 mb-6 pl-1">
          <div className="w-8 h-8 rounded-xl bg-[#25D366]/[0.08] flex items-center justify-center">
            <Settings size={16} className="text-[#25D366]" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">Settings</h2>
        </div>

        <nav className="flex flex-col gap-1">
          {sections.map(s => {
            const isActive = activeSection === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all relative group
                  ${isActive
                    ? 'bg-[#25D366]/[0.06] text-[#25D366]'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="settingsActiveIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#25D366]"
                  />
                )}
                <span className={isActive ? 'text-[#25D366]' : 'text-gray-400 group-hover:text-gray-600'}>{s.icon}</span>
                <div className="text-left">
                  <p className={`text-[14px] ${isActive ? 'font-semibold' : 'font-medium'}`}>{s.label}</p>
                  <p className="text-[11px] text-gray-400 font-normal">{s.description}</p>
                </div>
                <ChevronRight size={14} className={`ml-auto ${isActive ? 'text-[#25D366]' : 'text-gray-300'}`} />
              </button>
            );
          })}
        </nav>
      </div>

      {/* ─── Content ─── */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl">
          {activeSection === 'profile' && <ProfileSection />}
          {activeSection === 'workspaces' && <WorkspacesSection />}
          {activeSection === 'labels' && <LabelsSection />}
          {activeSection === 'whatsapp' && <WhatsAppConfigSection />}
          {activeSection === 'theme' && <ThemeSection />}
        </div>
      </div>
    </div>
  );
}

// ─── Profile Section ───
function ProfileSection() {
  const { state, setProfile } = useWorkspace();
  const p = state.profile;
  const [name, setName] = useState(p?.name || '');
  const [email, setEmail] = useState(p?.email || '');
  const [phone, setPhone] = useState(p?.phone || '');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Keep form in sync when profile loads from backend
  React.useEffect(() => {
    if (p) {
      if (p.name) setName(p.name);
      if (p.email) setEmail(p.email);
      if (p.phone) setPhone(p.phone);
    }
  }, [p]);

  const handleSave = async () => {
    if (!p) return;
    setSaving(true);
    try {
      await setProfile({ ...p, name: name.trim(), email: email.trim(), phone: phone.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const initials = (name || p?.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <h3 className="text-xl font-bold text-gray-900 mb-1 tracking-tight">Edit Profile</h3>
      <p className="text-sm text-gray-500 mb-6">Manage your personal information and preferences.</p>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Avatar header */}
        <div className="bg-gradient-to-r from-[#25D366]/5 to-[#128C7E]/5 px-6 py-5 border-b border-gray-100 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center text-white text-xl font-bold shadow-sm">
            {initials}
          </div>
          <div>
            <p className="text-[16px] font-bold text-gray-900">{name || p?.name || 'User'}</p>
            <p className="text-[13px] text-gray-500">{email || p?.email || ''}</p>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          <div>
            <label className="flex items-center gap-2 text-[13px] font-semibold text-gray-700 mb-1.5">
              <User size={14} className="text-gray-400" /> Full Name
            </label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] focus:bg-white transition-all"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-[13px] font-semibold text-gray-700 mb-1.5">
              <Mail size={14} className="text-gray-400" /> Email
            </label>
            <input
              value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] focus:bg-white transition-all"
              placeholder="name@company.com"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-[13px] font-semibold text-gray-700 mb-1.5">
              <Phone size={14} className="text-gray-400" /> Phone
            </label>
            <input
              value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] focus:bg-white transition-all"
              placeholder="+91 99999 99999"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-all flex items-center gap-2 disabled:opacity-50
              ${saved ? 'bg-emerald-500' : 'bg-[#25D366] hover:bg-[#1db954] shadow-green-600/15 hover:shadow-md'}
            `}
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : saved ? <><Check size={16} /> Saved!</> : 'Save Changes'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Workspaces Section ───
function WorkspacesSection() {
  const { state, addWorkspace, deleteWorkspace } = useWorkspace();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(WORKSPACE_COLORS[0]);
  const [newIcon, setNewIcon] = useState('Building2');
  const [showIconPicker, setShowIconPicker] = useState(false);

  const handleAdd = () => {
    if (!newName.trim()) return;
    addWorkspace({ name: newName.trim(), color: newColor, icon: newIcon });
    setNewName('');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <h3 className="text-xl font-bold text-gray-900 mb-1 tracking-tight">Manage Workspaces</h3>
      <p className="text-sm text-gray-500 mb-6">Create and manage your workspace environments.</p>

      {/* Existing workspaces */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <h4 className="text-[14px] font-bold text-gray-900">Active Workspaces ({state.workspaces.length})</h4>
        </div>
        <div className="divide-y divide-gray-50">
          {state.workspaces.map(ws => (
            <div key={ws.id} className="flex items-center justify-between px-6 py-4 hover:bg-[#25D366]/[0.01] transition-colors">
              <div className="flex items-center gap-3">
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                  style={{ backgroundColor: ws.color }}
                >
                  {renderIcon(ws.icon, { size: 18 })}
                </span>
                <div>
                  <span className="text-[14px] font-semibold text-gray-900">{ws.name}</span>
                  <p className="text-[11px] text-gray-400">Created {new Date(ws.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              {state.workspaces.length > 1 && (
                <button
                  onClick={() => { if (confirm(`Delete workspace "${ws.name}"?`)) deleteWorkspace(ws.id); }}
                  className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 text-gray-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500 flex items-center justify-center transition-colors"
                  title="Delete Workspace"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add new workspace */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h4 className="text-[14px] font-bold text-gray-900 mb-4">Create New Workspace</h4>
        <div className="flex flex-col md:flex-row gap-4 items-start">

          <div className="relative">
            <button
              onClick={() => setShowIconPicker(!showIconPicker)}
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 transition-transform hover:scale-105 shadow-sm"
              style={{ backgroundColor: newColor }}
            >
              {renderIcon(newIcon, { size: 20 })}
            </button>
            {showIconPicker && (
              <div className="absolute top-14 left-0 z-50 bg-white border border-gray-200 rounded-xl p-2.5 grid grid-cols-3 gap-1.5 shadow-xl">
                {ICON_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => { setNewIcon(opt); setShowIconPicker(false); }}
                    className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-[#25D366]/10 text-gray-600 hover:text-[#25D366] transition-colors"
                  >
                    {renderIcon(opt, { size: 18 })}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-3 w-full">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Workspace Name"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] focus:bg-white transition-all max-w-sm"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <div className="flex gap-2 flex-wrap">
              {WORKSPACE_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setNewColor(color)}
                  className="w-7 h-7 rounded-full transition-all hover:scale-110"
                  style={{
                    backgroundColor: color,
                    boxShadow: newColor === color ? `0 0 0 2px white, 0 0 0 4px ${color}` : 'none',
                    transform: newColor === color ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="w-full md:w-auto px-6 py-3 rounded-xl bg-[#25D366] text-white text-sm font-bold hover:bg-[#1db954] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm shadow-green-600/15"
          >
            <Plus size={18} /> Add
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── WhatsApp API Config ───
function WhatsAppConfigSection() {
  const [token, setToken] = useState('Loading...');
  const [phoneNumberId, setPhoneNumberId] = useState('Loading...');
  const [businessAccountId, setBusinessAccountId] = useState('Loading...');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    fetch('/api/get-env-variables')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setToken(data.env.accessToken || '');
          setPhoneNumberId(data.env.phoneNumberId || '');
          setBusinessAccountId(data.env.verificationToken || '');
        }
      })
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/save-env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token })
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <h3 className="text-xl font-bold text-gray-900 mb-1 tracking-tight">WhatsApp API Configuration</h3>
      <p className="text-sm text-gray-500 mb-6">Update your Meta developer credentials to send and receive messages.</p>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Security notice */}
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-3 flex items-center gap-2">
          <Shield size={14} className="text-amber-600 shrink-0" />
          <p className="text-[12px] text-amber-700 font-medium">
            Credentials are stored securely in your environment configuration.
          </p>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="flex items-center justify-between text-[13px] font-semibold text-gray-700 mb-1.5">
              <span className="flex items-center gap-2">
                <Shield size={14} className="text-gray-400" />
                Temporary Access Token
              </span>
              <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-[#25D366] hover:underline flex items-center gap-1">
                Get Token <ExternalLink size={11} />
              </a>
            </label>
            <textarea
              value={token} onChange={e => setToken(e.target.value)} rows={3}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-[13px] font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] focus:bg-white transition-all resize-none"
            />
            <p className="text-[11px] text-amber-600 mt-1.5 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Token expires in ~24 hours. Refresh manually from Meta Developer Dashboard.
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-[13px] font-semibold text-gray-700 mb-1.5">
              <Smartphone size={14} className="text-gray-400" />
              Phone Number ID
            </label>
            <input
              value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-[13px] font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-[13px] font-semibold text-gray-700 mb-1.5">
              <Building2 size={14} className="text-gray-400" />
              WhatsApp Business Account ID
            </label>
            <input
              value={businessAccountId} onChange={e => setBusinessAccountId(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-[13px] font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-all flex items-center gap-2 disabled:opacity-50
              ${saved ? 'bg-emerald-500' : 'bg-[#25D366] hover:bg-[#1db954] shadow-green-600/15 hover:shadow-md'}
            `}
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : saved ? <><Check size={16} /> Saved!</> : 'Save Configuration'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Theme Section ───
function ThemeSection() {
  const { state: { theme }, setTheme } = useWorkspace();

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <h3 className="text-xl font-bold text-gray-900 mb-1 tracking-tight">Appearance</h3>
      <p className="text-sm text-gray-500 mb-6">Personalize your dashboard look and feel.</p>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex gap-4">
          {/* Light Mode */}
          <button
            onClick={() => setTheme('light')}
            className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3
              ${theme === 'light' ? 'border-[#25D366] bg-[#25D366]/[0.03]' : 'border-gray-100 hover:border-gray-300'}
            `}
          >
            <div className="w-full h-24 rounded-xl bg-gray-50 border border-gray-200 overflow-hidden flex flex-col">
              <div className="h-4 bg-white border-b border-gray-200 flex items-center px-2 gap-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-300" />
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-300" />
                <div className="w-1.5 h-1.5 rounded-full bg-green-300" />
              </div>
              <div className="flex-1 flex px-2 pt-2 gap-1.5">
                <div className="w-4 bg-gray-200 rounded-sm" />
                <div className="flex-1 bg-white rounded-sm shadow-sm border border-gray-100" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {theme === 'light' && <Check size={14} className="text-[#25D366]" />}
              <span className={`text-sm ${theme === 'light' ? 'font-bold text-[#25D366]' : 'font-semibold text-gray-700'}`}>
                Light Mode
              </span>
            </div>
          </button>

          {/* Dark Mode */}
          <button
            onClick={() => setTheme('dark')}
            className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3
              ${theme === 'dark' ? 'border-[#25D366] bg-[#25D366]/[0.03]' : 'border-gray-100 hover:border-gray-300'}
            `}
          >
            <div className="w-full h-24 rounded-xl bg-gray-800 border border-gray-700 overflow-hidden flex flex-col">
              <div className="h-4 bg-gray-900 border-b border-gray-700 flex items-center px-2 gap-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 flex px-2 pt-2 gap-1.5">
                <div className="w-4 bg-gray-700 rounded-sm" />
                <div className="flex-1 bg-gray-600 rounded-sm" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {theme === 'dark' && <Check size={14} className="text-[#25D366]" />}
              <span className={`text-sm ${theme === 'dark' ? 'font-bold text-[#25D366]' : 'font-semibold text-gray-700'}`}>
                Dark Mode
              </span>
            </div>
          </button>
        </div>
        <p className="text-[12px] text-gray-400 mt-5 text-center">
          Theme preference is saved locally to your browser.
        </p>
      </div>
    </motion.div>
  );
}

// ─── Labels Section ───
function LabelsSection() {
  const { state, addChatLabel, deleteChatLabel } = useWorkspace();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<LabelColor>('blue');

  const workspaceLabels = state.chatLabels.filter(l => l.workspaceId === state.activeWorkspaceId);

  const handleAdd = async () => {
    if (!newName.trim() || !state.activeWorkspaceId) return;
    try {
      await addChatLabel({ name: newName.trim(), color: newColor, workspaceId: state.activeWorkspaceId });
      setNewName('');
    } catch(e) {
      console.error(e);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <h3 className="text-xl font-bold text-gray-900 mb-1 tracking-tight">Chat Labels</h3>
      <p className="text-sm text-gray-500 mb-6">Organize your WhatsApp conversations with color-coded tags.</p>

      {/* Existing Labels */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h4 className="text-[14px] font-bold text-gray-900">Workspace Labels ({workspaceLabels.length})</h4>
        </div>
        <div className="divide-y divide-gray-50">
          {workspaceLabels.map(label => (
            <div key={label.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <span
                  className="w-3 h-3 rounded-full shadow-sm"
                  style={{ backgroundColor: LABEL_COLORS[label.color] }}
                />
                <span className="text-[14px] font-bold text-gray-700">{label.name}</span>
              </div>
              <button
                onClick={() => { if (confirm(`Delete label "${label.name}"?`)) deleteChatLabel(label.id); }}
                className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 text-gray-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500 flex items-center justify-center transition-colors"
                title="Delete Label"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {workspaceLabels.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-gray-400 font-medium">No labels found.</div>
          )}
        </div>
      </div>

      {/* Add New Label */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h4 className="text-[14px] font-bold text-gray-900 mb-4">Create New Label</h4>
        <div className="flex flex-col md:flex-row gap-5 items-start md:items-center">
          
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Label Name (e.g. VIP)"
            className="flex-1 w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] focus:bg-white transition-all"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />

          <div className="flex items-center gap-2">
            {(Object.keys(LABEL_COLORS) as LabelColor[]).map(color => (
              <button
                key={color}
                onClick={() => setNewColor(color)}
                className="w-6 h-6 rounded-full transition-all hover:scale-110"
                style={{
                  backgroundColor: LABEL_COLORS[color],
                  boxShadow: newColor === color ? `0 0 0 2px white, 0 0 0 4px ${LABEL_COLORS[color]}` : 'none',
                  transform: newColor === color ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
          </div>

          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="w-full md:w-auto px-6 py-2.5 rounded-xl bg-[#25D366] text-white text-sm font-bold hover:bg-[#1db954] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm shadow-green-600/15"
          >
            <Plus size={16} /> Create
          </button>
        </div>
      </div>
    </motion.div>
  );
}
