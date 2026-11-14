import type { AppProps } from 'next/app';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/router';
import '../styles/globals.css';
import '../../../packages/ui/dashboard-theme.css';

import { ToastProvider } from '@kongila/ui';
import { supabase } from '../lib/supabaseClient';
import { apiFetch } from '../lib/apiFetch';
import { isAdminRole } from '@kongila/auth';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ToastProvider>
      <ProtectedAdminRoute>
        <Component {...pageProps} />
      </ProtectedAdminRoute>
    </ToastProvider>
  );
}

function ProtectedAdminRoute({ children }: { children: ReactNode }) {
  const router = useRouter();
  const isAdminIndex = router.pathname === '/';
  const isPasswordActivation = router.pathname === '/set-password';
  const isNotFound = router.pathname === '/404';
  const protectedRoute = !isAdminIndex && !isPasswordActivation && !isNotFound;
  const [state, setState] = useState<'checking' | 'allowed' | 'error'>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!router.isReady) return;
    if (!protectedRoute) {
      setState('allowed');
      return;
    }

    let active = true;
    setState('checking');
    const returnTo = router.asPath.startsWith('/') && !router.asPath.startsWith('//') ? router.asPath : '/';
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT' && active) {
        setState('checking');
        void router.replace({ pathname: '/', query: { next: returnTo } });
      }
    });

    const verify = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session?.user) {
          if (active) void router.replace({ pathname: '/', query: { next: returnTo } });
          return;
        }

        const response = await apiFetch('/api/session');
        if (response.status === 401 || response.status === 403) {
          if (active) void router.replace({ pathname: '/', query: { next: returnTo } });
          return;
        }
        if (!response.ok) throw new Error('Could not verify administrator permissions.');
        const identity = await response.json();
        if (!isAdminRole(identity?.role)) {
          if (active) void router.replace({ pathname: '/', query: { next: returnTo } });
          return;
        }
        if (active) setState('allowed');
      } catch (error) {
        console.error('[admin route guard] permission check failed', error);
        if (active) setState('error');
      }
    };

    void verify();
    return () => { active = false; subscription.unsubscribe(); };
  }, [router.isReady, router.pathname, router.asPath, protectedRoute, attempt, router]);

  if (!protectedRoute || state === 'allowed') return <>{children}</>;
  return (
    <div role={state === 'error' ? 'alert' : 'status'} aria-live="polite" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0B0F19', color: '#fff', fontFamily: 'sans-serif' }}>
      {state === 'error' ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <p>We couldn’t verify access to this admin page.</p>
          <button type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button>
        </div>
      ) : 'Verifying admin access…'}
    </div>
  );
}
