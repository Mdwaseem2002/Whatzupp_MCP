'use client';

// src/components/app/TemplatesView.tsx
// Dedicated Templates screen — fetches and displays Meta (WABA) approved templates.
// No local storage — always fetches real-time from Meta API.

import React, { useState, useEffect } from 'react';
import { RefreshCw, LayoutTemplate, ExternalLink, Search, AlertTriangle, Loader2, Eye, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TemplateComponent {
  type: string;
  text?: string;
  format?: string;
  buttons?: Array<{ type: string; text: string; url?: string }>;
}

interface Template {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: TemplateComponent[];
}

const getCategoryStyle = (category: string) => {
  switch (category?.toUpperCase()) {
    case 'UTILITY':
      return 'bg-emerald-50 text-emerald-600 border border-emerald-200';
    case 'MARKETING':
      return 'bg-blue-50 text-blue-600 border border-blue-200';
    case 'AUTHENTICATION':
      return 'bg-amber-50 text-amber-600 border border-amber-200';
    default:
      return 'bg-gray-50 text-gray-500 border border-gray-200';
  }
};

const getComponentText = (template: Template, type: string): string | undefined => {
  return template.components?.find(c => c.type === type)?.text;
};

const getButtons = (template: Template): Array<{ type: string; text: string; url?: string }> => {
  const buttonsComponent = template.components?.find(c => c.type === 'BUTTONS');
  return (buttonsComponent as unknown as { buttons?: Array<{ type: string; text: string; url?: string }> })?.buttons || [];
};

export default function TemplatesView() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/templates');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const metaDetail = errData.details?.error?.message;
        const msg = metaDetail ? `${errData.error || 'Meta Error'}: ${metaDetail}` : (errData.error || `HTTP ${response.status}`);
        throw new Error(msg);
      }
      const data = await response.json();
      if (data.success && Array.isArray(data.templates)) {
        setTemplates(data.templates);
        // Auto-select first template if none selected
        if (!selectedTemplate && data.templates.length > 0) {
          setSelectedTemplate(data.templates[0]);
        }
      } else {
        setTemplates([]);
      }
    } catch (err: any) {
      console.error('Error fetching templates:', err);
      setError(err.message || 'Could not load templates. Check your WABA_ID configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Filtering
  const filteredTemplates = templates.filter(t => {
    const matchesSearch = !searchQuery || 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || t.category.toUpperCase() === filterCategory.toUpperCase();
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category.toUpperCase())))];

  return (
    <div className="flex flex-1 h-full overflow-hidden bg-[#F8FAFC]">
      
      {/* ─── Left: Template List ─── */}
      <div className="w-[420px] bg-white border-r border-gray-200 flex flex-col shrink-0">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">Templates</h1>
              <p className="text-[13px] text-gray-500 mt-0.5">
                {loading ? 'Loading...' : `${templates.length} approved templates from Meta`}
              </p>
            </div>
            <motion.button
              onClick={fetchTemplates}
              disabled={loading}
              className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-[#25D366] hover:border-[#25D366]/30 hover:bg-[#25D366]/5 transition-colors disabled:opacity-50"
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.3 }}
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </motion.button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/10 transition-all"
            />
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold capitalize whitespace-nowrap transition-all
                  ${filterCategory === cat 
                    ? 'bg-[#25D366] text-white shadow-sm' 
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200'}
                `}
              >
                {cat === 'all' ? 'All' : cat.toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Template List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#25D366] mb-3" />
              <p className="text-sm text-gray-500">Fetching templates from Meta...</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
                <AlertTriangle size={24} className="text-red-500" />
              </div>
              <p className="text-sm font-semibold text-red-600 mb-1">Failed to load templates</p>
              <p className="text-[13px] text-gray-500 mb-4">{error}</p>
              <button onClick={fetchTemplates} className="text-sm font-semibold text-[#25D366] hover:underline">
                Try again
              </button>
            </div>
          )}

          {!loading && !error && filteredTemplates.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <LayoutTemplate size={24} className="text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-1">No templates found</p>
              <p className="text-[13px] text-gray-500">
                {searchQuery ? 'Try adjusting your search.' : 'Create templates in Meta Business Manager.'}
              </p>
            </div>
          )}

          {!loading && !error && filteredTemplates.length > 0 && (
            <div className="p-3 space-y-2">
              {filteredTemplates.map((template) => {
                const isActive = selectedTemplate?.id === template.id;
                const bodyText = getComponentText(template, 'BODY');
                const preview = bodyText ? (bodyText.length > 80 ? bodyText.substring(0, 77) + '...' : bodyText) : 'No body text';
                
                return (
                  <motion.button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template)}
                    className={`w-full text-left rounded-xl p-4 transition-all duration-200 group border
                      ${isActive 
                        ? 'bg-[#25D366]/[0.04] border-[#25D366]/30 shadow-sm' 
                        : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'}
                    `}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className={`text-[14px] font-semibold truncate pr-2 ${isActive ? 'text-[#25D366]' : 'text-gray-900'}`}>
                        {template.name}
                      </h3>
                      <ChevronRight size={14} className={`shrink-0 mt-0.5 ${isActive ? 'text-[#25D366]' : 'text-gray-300 group-hover:text-gray-400'}`} />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md ${getCategoryStyle(template.category)}`}>
                        {template.category}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-gray-50 text-gray-500 border border-gray-200 font-semibold">
                        {template.language}
                      </span>
                    </div>
                    <p className="text-[13px] text-gray-500 leading-relaxed line-clamp-2">{preview}</p>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Right: WhatsApp Preview Panel ─── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#F8FAFC]">
        {selectedTemplate ? (
          <div className="w-full max-w-[420px]">
            {/* Preview Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Eye size={18} className="text-gray-400" />
                <h2 className="text-lg font-bold text-gray-900">Message Preview</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-lg ${getCategoryStyle(selectedTemplate.category)}`}>
                  {selectedTemplate.category}
                </span>
                <span className="text-[11px] text-gray-500 font-medium">
                  {selectedTemplate.language}
                </span>
              </div>
            </div>

            {/* Phone Frame */}
            <div className="bg-gray-900 rounded-[2rem] p-3 shadow-2xl shadow-black/20">
              {/* Phone Header */}
              <div className="bg-[#128C7E] rounded-t-[1.5rem] px-5 py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
                  W
                </div>
                <div>
                  <p className="text-white font-semibold text-[14px]">WhatZupp Business</p>
                  <p className="text-white/60 text-[11px]">Official Business Account</p>
                </div>
              </div>

              {/* Messages Area */}
              <div className="bg-[#ECE5DD] min-h-[320px] px-4 py-5 flex flex-col justify-end gap-2" 
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23c5bfb5\' fill-opacity=\'0.15\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}>
                
                {/* Message Bubble */}
                <div className="max-w-[85%] self-start">
                  <div className="bg-white rounded-2xl rounded-tl-sm shadow-sm overflow-hidden">
                    {/* Header */}
                    {getComponentText(selectedTemplate, 'HEADER') && (
                      <div className="px-4 pt-3 pb-1">
                        <p className="text-[14px] font-bold text-gray-900">
                          {getComponentText(selectedTemplate, 'HEADER')}
                        </p>
                      </div>
                    )}

                    {/* Body */}
                    {getComponentText(selectedTemplate, 'BODY') && (
                      <div className="px-4 py-2">
                        <p className="text-[14px] leading-relaxed text-gray-800 whitespace-pre-wrap">
                          {getComponentText(selectedTemplate, 'BODY')}
                        </p>
                      </div>
                    )}

                    {/* Footer */}
                    {getComponentText(selectedTemplate, 'FOOTER') && (
                      <div className="px-4 pb-1">
                        <p className="text-[12px] text-gray-400 italic">
                          {getComponentText(selectedTemplate, 'FOOTER')}
                        </p>
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="flex justify-end px-4 pb-2">
                      <span className="text-[10px] text-gray-400 font-medium">
                        {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    </div>

                    {/* Buttons */}
                    {getButtons(selectedTemplate).length > 0 && (
                      <div className="border-t border-gray-100">
                        {getButtons(selectedTemplate).map((btn, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-center gap-1.5 py-2.5 text-[14px] text-[#25D366] font-medium cursor-pointer hover:bg-gray-50 transition-colors"
                            style={{ borderBottom: idx < getButtons(selectedTemplate).length - 1 ? '1px solid #f1f5f9' : 'none' }}
                          >
                            {btn.url && <ExternalLink size={14} />}
                            {btn.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Phone Bottom Bar */}
              <div className="bg-[#F0F0F0] rounded-b-[1.5rem] px-4 py-3 flex items-center gap-2">
                <div className="flex-1 bg-white rounded-full px-4 py-2 text-[13px] text-gray-400">
                  Type a message
                </div>
                <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="m21.4 11.6-17-8c-.7-.3-1.4.3-1.2 1l1.8 6.4h9v2h-9l-1.8 6.4c-.2.7.5 1.3 1.2 1l17-8c.6-.3.6-1.1 0-1.4z"/></svg>
                </div>
              </div>
            </div>

            {/* Template Info */}
            <div className="mt-5 bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-bold text-gray-900">{selectedTemplate.name}</p>
                  <p className="text-[12px] text-gray-500 mt-0.5">Template ID: {selectedTemplate.id}</p>
                </div>
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  ✓ APPROVED
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl bg-[#25D366]/[0.08] flex items-center justify-center mx-auto mb-5">
              <LayoutTemplate size={32} className="text-[#25D366]" />
            </div>
            <p className="text-lg font-bold text-gray-900">Select a template to preview</p>
            <p className="text-sm text-gray-500 mt-1">Choose a template from the list to see how it looks</p>
          </div>
        )}
      </div>
    </div>
  );
}
