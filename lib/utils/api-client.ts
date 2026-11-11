'use client';

/**
 * Robust authenticated fetch client for all LedgerLine frontend modules.
 * Automatically injects the JWT authentication token from localStorage
 * and handles base headers.
 */
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('ledgerline_token') : null;
  const headers = new Headers(init.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...init,
    headers,
  });
}

