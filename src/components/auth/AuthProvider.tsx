'use client';

// src/components/auth/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';

export interface UserSession {
  userId: string;
  email: string;
  fullName: string;
  tenantId: string | null;
  tenantCode?: string | null;
  tenantName?: string | null;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'TENANT_USER';
  workspacePermissions: string[];
}

interface AuthContextType {
  user: UserSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isTenantAdmin: boolean;
  hasWorkspacePermission: (workspace: string) => boolean;
  login: (session: UserSession) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const login = (session: UserSession) => {
    setUser(session);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore network errors on logout
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  };

  const hasWorkspacePermission = (workspace: string): boolean => {
    if (!user) return true; // Default fallback for open workspace demo mode
    if (user.role === 'SUPER_ADMIN') return true;
    if (Array.isArray(user.workspacePermissions) && user.workspacePermissions.length > 0) {
      return user.workspacePermissions.includes(workspace);
    }
    return true;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isSuperAdmin: user?.role === 'SUPER_ADMIN',
        isTenantAdmin: user?.role === 'TENANT_ADMIN' || user?.role === 'SUPER_ADMIN',
        hasWorkspacePermission,
        login,
        logout,
        refreshSession: fetchSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
