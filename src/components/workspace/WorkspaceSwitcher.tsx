'use client';

// src/components/workspace/WorkspaceSwitcher.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { useAuth } from '@/components/auth/AuthProvider';
import { Building2, Briefcase, Globe, Users2, ShoppingBag, Zap, ChevronDown, Check } from 'lucide-react';

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

export default function WorkspaceSwitcher() {
  const { state, activeWorkspace, setActiveWorkspace } = useWorkspace();
  const { hasWorkspacePermission } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Filter workspaces by permission
  const allowedWorkspaces = state.workspaces.filter(ws => {
    if (ws.type === 'salescloud') return hasWorkspacePermission('SALES_CLOUD');
    if (ws.type === 'sfmc') return hasWorkspacePermission('SFMC');
    return true;
  });

  if (!activeWorkspace) return null;

  return (
    <div ref={ref} className="relative font-sans">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 py-1.5 px-3 pr-2 rounded-xl bg-white border border-gray-200 hover:border-[#25D366]/30 hover:bg-gray-50 transition-all focus:outline-none focus:ring-2 focus:ring-[#25D366]/20"
      >
        <span 
          className="w-5 h-5 rounded-md flex items-center justify-center text-white"
          style={{ backgroundColor: activeWorkspace.color }}
        >
          {renderIcon(activeWorkspace.icon, { size: 12, strokeWidth: 2.5 })}
        </span>
        <span className="text-sm font-semibold text-gray-900 tracking-tight">
          {activeWorkspace.name}
        </span>
        {allowedWorkspaces.length > 1 && (
          <ChevronDown 
            size={14} 
            className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {open && allowedWorkspaces.length > 1 && (
        <div className="absolute top-[calc(100%+8px)] left-0 min-w-[240px] bg-white border border-gray-200 rounded-xl shadow-lg shadow-black/[0.08] z-[100] py-1.5 focus:outline-none">
          <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            Licensed Workspaces
          </div>
          <div className="flex flex-col">
            {allowedWorkspaces.map(ws => (
              <button
                key={ws.id}
                onClick={() => { setActiveWorkspace(ws.id); setOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors ${ws.id === activeWorkspace.id ? 'bg-[#25D366]/[0.04]' : 'bg-transparent'}`}
              >
                <div className="flex items-center gap-3">
                  <span 
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: ws.color }}
                  >
                    {renderIcon(ws.icon, { size: 14 })}
                  </span>
                  <span className={`text-sm ${ws.id === activeWorkspace.id ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'}`}>
                    {ws.name}
                  </span>
                </div>
                {ws.id === activeWorkspace.id && (
                  <Check size={16} className="text-[#25D366]" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
