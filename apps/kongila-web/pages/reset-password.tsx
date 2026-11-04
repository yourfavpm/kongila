import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { supabase } from '../lib/supabaseClient';

/**
 * Password reset.
 *
 * There was no account recovery path of any kind. A user who forgot their
 * password had no way back in, and nothing in the product said so.
 *
 * Two halves on one page, because Supabase brings the user back here with a
 * recovery session in the URL:
 *
 *   1. Signed out, no recovery session: ask for an email address and send
 *      the link.
 *   2. Arriving from that link: Supabase has put a recovery session in
 *      place, so ask for the new password and set it.
 *
 * The request half deliberately gives the same answer whether or not the
 * address exists. Saying "no account with that email" tells anyone who asks
 * which addresses are registered.
 */
export default function ResetPassword() {
  const [stage, setStage] = useState<'request' | 'set' | 'checking'>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Supabase puts the recovery token in the URL fragment and exchanges it
    // for a session as the client starts, so the session is what to check.
    const decide = async () => {
      const { data } = await supabase.auth.getSession();
      const isRecovery = typeof window !== 'undefined'
        && window.location.hash.includes('type=recovery');
      if (cancelled) return;
      setStage(data.session && isRecovery ? 'set' : 'request');
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStage('set');
    });

    decide();
    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const requestLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`
    });

    if (error) console.error('[reset-password] request failed:', error.message);

    // Same answer either way, deliberately. See the note at the top.
    setMessage({
      kind: 'ok',
      text: 'If there is an account for that address, a reset link is on its way. Check your inbox and your spam folder.'
    });
    setBusy(false);
  };

  const setNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    if (password.length < 8) {
      setMessage({ kind: 'error', text: 'Use at least 8 characters.' });
      return;
    }
    if (password !== confirm) {
      setMessage({ kind: 'error', text: 'Those two passwords do not match.' });
      return;
    }

    setBusy(true);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage({ kind: 'error', text: error.message });
      setBusy(false);
      return;
    }

    setMessage({ kind: 'ok', text: 'Your password is set. Taking you to sign in.' });
    setTimeout(() => { window.location.href = '/'; }, 1500);
  };

  const card: React.CSSProperties = {
    background: '#FFFFFF',
    borderRadius: '16px',
    padding: '32px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)'
  };
  const input: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid #CBD5E1',
    fontSize: '15px',
    marginBottom: '14px',
    boxSizing: 'border-box'
  };
  const button: React.CSSProperties = {
    width: '100%',
    padding: '13px',
    borderRadius: '10px',
    border: 'none',
    background: busy ? '#93C5FD' : '#0047CC',
    color: '#FFFFFF',
    fontSize: '15px',
    fontWeight: 700,
    cursor: busy ? 'not-allowed' : 'pointer'
  };

  return (
    <>
      <Head><title>Reset your password — Kongila</title></Head>
      <div style={{
        minHeight: '100vh',
        background: '#F5F7FA',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: '"Inter", system-ui, sans-serif'
      }}>
        <div style={card}>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0' }}>
            {stage === 'set' ? 'Choose a new password' : 'Reset your password'}
          </h1>
          <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 24px 0' }}>
            {stage === 'set'
              ? 'Pick something you have not used here before.'
              : 'We will email you a link to set a new one.'}
          </p>

          {message && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '10px',
              marginBottom: '16px',
              fontSize: '14px',
              background: message.kind === 'ok' ? '#ECFDF5' : '#FEF2F2',
              color: message.kind === 'ok' ? '#047857' : '#B91C1C',
              border: `1px solid ${message.kind === 'ok' ? '#A7F3D0' : '#FECACA'}`
            }}>
              {message.text}
            </div>
          )}

          {stage === 'checking' && (
            <p style={{ fontSize: '14px', color: '#94A3B8' }}>One moment.</p>
          )}

          {stage === 'request' && (
            <form onSubmit={requestLink}>
              <input
                style={input}
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
              />
              <button style={button} type="submit" disabled={busy}>
                {busy ? 'Sending...' : 'Send the reset link'}
              </button>
            </form>
          )}

          {stage === 'set' && (
            <form onSubmit={setNewPassword}>
              <input
                style={input}
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="New password"
                autoComplete="new-password"
              />
              <input
                style={input}
                type="password"
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
              <button style={button} type="submit" disabled={busy}>
                {busy ? 'Saving...' : 'Set my password'}
              </button>
            </form>
          )}

          <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '20px', textAlign: 'center' }}>
            <a href="/" style={{ color: '#0047CC', textDecoration: 'none', fontWeight: 600 }}>
              Back to sign in
            </a>
          </p>
        </div>
      </div>
    </>
  );
}
