import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function SetPasswordPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [validLink, setValidLink] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active || !session) return;
      setEmail(session?.user.email || '');
      setValidLink(true);
      setChecking(false);
    });

    const resolveInvitation = async () => {
      const callbackUrl = new URL(window.location.href);
      const callbackError = callbackUrl.searchParams.get('error_description') || callbackUrl.searchParams.get('error');
      if (callbackError) throw new Error(callbackError);

      // Supabase can return a session itself (implicit flow), or deliver a
      // PKCE code / token hash depending on the project auth configuration.
      let { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      let session = data.session;

      if (!session && callbackUrl.searchParams.has('token_hash')) {
        const tokenHash = callbackUrl.searchParams.get('token_hash') || '';
        const rawType = callbackUrl.searchParams.get('type') || 'invite';
        const supportedTypes = ['invite', 'signup', 'magiclink', 'recovery', 'email_change', 'email'];
        if (!supportedTypes.includes(rawType)) throw new Error('This invitation link has an unsupported verification type.');
        const verified = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: rawType as any });
        if (verified.error) throw verified.error;
        session = verified.data.session;
      }

      if (!session && callbackUrl.searchParams.has('code')) {
        const exchanged = await supabase.auth.exchangeCodeForSession(callbackUrl.searchParams.get('code') || '');
        if (exchanged.error) throw exchanged.error;
        session = exchanged.data.session;
      }

      if (!session && window.location.hash) {
        const fragment = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = fragment.get('access_token');
        const refreshToken = fragment.get('refresh_token');
        if (accessToken && refreshToken) {
          const restored = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (restored.error) throw restored.error;
          session = restored.data.session;
        }
      }

      if (!active) return;
      setEmail(session?.user.email || '');
      setValidLink(Boolean(session));
      setChecking(false);
      // Remove one-time credentials from the address bar after Supabase has
      // accepted them. Do not leave invite tokens in browser history.
      if (session) window.history.replaceState({}, document.title, callbackUrl.pathname);
    };

    void resolveInvitation().catch((cause: any) => {
      if (!active) return;
      setError(`The invitation could not be verified: ${cause?.message || 'The link may have expired.'}`);
      setValidLink(false);
      setChecking(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(`Your password was not saved: ${updateError.message}`);
      setBusy(false);
      return;
    }

    const { error: signOutError } = await supabase.auth.signOut();
    setSuccess(true);
    if (signOutError) {
      setError(`Your password was set, but the session could not be closed. Sign out before sharing this device. ${signOutError.message}`);
    } else {
      window.setTimeout(() => { void router.replace('/'); }, 1200);
    }
  };

  return (
    <main style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px',
      background: '#F3F6FB', color: '#1A2340', fontFamily: 'Arial, Helvetica, sans-serif'
    }}>
      <section style={{
        width: '100%', maxWidth: '440px', boxSizing: 'border-box', padding: '36px',
        background: '#fff', borderRadius: '16px', boxShadow: '0 12px 40px rgba(0, 43, 127, .12)'
      }}>
        <div style={{ color: '#0047CC', fontWeight: 800, fontSize: '24px', marginBottom: '28px' }}>
          Kongila
        </div>
        <h1 style={{ margin: '0 0 10px', fontSize: '24px' }}>Set your password</h1>
        {checking ? (
          <p>Verifying your secure invitation…</p>
        ) : success ? (
          <>
            <p>Your password is set. {error ? 'Please sign out before sharing this device.' : 'Redirecting you to sign in…'}</p>
            {error && <p role="alert" style={{ color: '#B91C1C' }}>{error}</p>}
          </>
        ) : !validLink ? (
          <>
            <p role={error ? 'alert' : undefined} style={error ? { color: '#B91C1C' } : undefined}>
              {error || 'This invitation link is invalid or has expired. Ask your Kongila administrator to send you a new invitation.'}
            </p>
          </>
        ) : (
          <>
            <p style={{ color: '#526078', margin: '0 0 24px' }}>
              Activate your administrator account{email ? ` for ${email}` : ''}.
            </p>
            <form onSubmit={submit}>
              <label htmlFor="password" style={{ display: 'block', fontWeight: 700, marginBottom: '8px' }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={event => setPassword(event.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px', marginBottom: '18px' }}
              />
              <label htmlFor="confirm-password" style={{ display: 'block', fontWeight: 700, marginBottom: '8px' }}>
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px', marginBottom: '18px' }}
              />
              {error && <p role="alert" style={{ color: '#B91C1C' }}>{error}</p>}
              <button
                type="submit"
                disabled={busy}
                style={{
                  width: '100%', border: 0, borderRadius: '8px', padding: '13px',
                  background: '#0047CC', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer'
                }}
              >
                {busy ? 'Saving…' : 'Set password'}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
