'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { UserProfile, UserRole } from '@/types/auth';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: UserProfile }>;
  register: (data: { email: string; password: string; full_name: string; phone?: string; role?: UserRole }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: async () => { },
  refreshUser: async () => { },
});

export const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password'];

export function getDefaultRouteForRole(role: UserRole): string {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'AUDITOR':
      return '/auditor';
    case 'ACCOUNT_HOLDER':
    default:
      return '/dashboard';
  }
}

export function isRouteAllowedForRole(role: UserRole, path: string): boolean {
  if (role === 'ADMIN') {
    return true; // System administrators have oversight across all modules
  }

  if (role === 'ACCOUNT_HOLDER') {
    // Account Holders are strictly restricted to personal banking
    if (path.startsWith('/admin') || path.startsWith('/auditor')) {
      return false;
    }
    return true;
  }

  if (role === 'AUDITOR') {
    // Auditors can access audit/integrity suites and read-only account/transaction supervision
    // Strictly forbidden from personal banking and administrative modification actions
    if (
      path.startsWith('/dashboard') ||
      path === '/admin' ||
      path.startsWith('/admin/users') ||
      path.startsWith('/admin/reversals') ||
      path.startsWith('/transactions/transfer') ||
      path.startsWith('/transactions/deposit-withdraw')
    ) {
      return false;
    }
    return true;
  }

  return false;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchCurrentUser = async (authToken?: string) => {
    const t = authToken || (typeof window !== 'undefined' ? localStorage.getItem('ledgerline_token') : null);
    if (!t) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/v1/auth/me', {
        headers: {
          Authorization: `Bearer ${t}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.data.user);
        setToken(t);
        if (typeof window !== 'undefined') {
          localStorage.setItem('ledgerline_token', t);
        }
      } else {
        setUser(null);
        setToken(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('ledgerline_token');
        }
      }
    } catch (err) {
      console.error('Error fetching current user:', err);
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // Route protection
  useEffect(() => {
    if (loading) return;

    const isPublic = PUBLIC_ROUTES.includes(pathname);

    if (!user && !isPublic && pathname !== '/') {
      router.push('/login');
    } else if (user) {
      if (isPublic || pathname === '/') {
        // Redirect to default home for role
        router.push(getDefaultRouteForRole(user.role));
      } else if (!isRouteAllowedForRole(user.role, pathname)) {
        // Enforce strict role isolation - bounce unauthorized attempts
        console.warn(`Unauthorized route attempt: role ${user.role} tried accessing ${pathname}`);
        router.push(getDefaultRouteForRole(user.role));
      }
    }
  }, [user, loading, pathname, router]);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Login failed' };
      }

      const receivedToken = data.data.token;
      const loggedInUser = data.data.user;

      setToken(receivedToken);
      setUser(loggedInUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ledgerline_token', receivedToken);
      }

      // Navigate based on role
      if (loggedInUser.role === 'ADMIN') {
        router.push('/admin');
      } else if (loggedInUser.role === 'AUDITOR') {
        router.push('/auditor');
      } else {
        router.push('/dashboard');
      }

      return { success: true, user: loggedInUser };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  };

  const register = async (formData: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
    role?: UserRole;
  }) => {
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Registration failed' };
      }

      const receivedToken = data.data.token;
      const newUser = data.data.user;
      const isPending = newUser?.status === 'PENDING' || data.data.pendingApproval;

      if (isPending) {
        // User must wait for administrator approval; do not start session
        return { success: true, pendingApproval: true, user: newUser };
      }

      setToken(receivedToken);
      setUser(newUser);
      if (typeof window !== 'undefined' && receivedToken) {
        localStorage.setItem('ledgerline_token', receivedToken);
      }

      if (newUser.role === 'ADMIN') {
        router.push('/admin');
      } else if (newUser.role === 'AUDITOR') {
        router.push('/auditor');
      } else {
        router.push('/dashboard');
      }

      return { success: true, pendingApproval: false, user: newUser };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (e) {
      // ignore logout network errors
    } finally {
      setUser(null);
      setToken(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ledgerline_token');
      }
      router.push('/login');
    }
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
