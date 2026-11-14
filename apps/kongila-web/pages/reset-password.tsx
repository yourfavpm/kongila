import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { requestEmailOtp, resetPasswordWithEmailOtp } from '../lib/emailOtpClient';
import { supabase } from '../lib/supabaseClient';

export default function ResetPassword() {
  const router = useRouter();
  const [stage, setStage] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const requestCode = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);

    try {
      const result = await requestEmailOtp(email.trim(), 'password_reset');
      setStage('verify');
      setMessage({
        kind: 'ok',
        text: result.message || 'If an account exists for that address, a six-digit code is on its way.'
      });
    } catch (error: any) {
      setMessage({ kind: 'error', text: error?.message || 'Could not request a reset code.' });
    } finally {
      setBusy(false);
    }
  };

  const submitRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    await requestCode();
  };

  const setNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    if (!/^\d{6}$/.test(code)) {
      setMessage({ kind: 'error', text: 'Enter the six-digit code from your email.' });
      return;
    }
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

    try {
      await resetPasswordWithEmailOtp({ email: email.trim(), code, password });
      await supabase.auth.signOut();
      setMessage({ kind: 'ok', text: 'Your password is set. Taking you to sign in.' });
      setTimeout(() => { void router.replace('/login'); }, 1500);
    } catch (error: any) {
      setMessage({ kind: 'error', text: error?.message || 'Could not reset the password.' });
    } finally {
      setBusy(false);
    }
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
            {stage === 'verify' ? 'Choose a new password' : 'Reset your password'}
          </h1>
          <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 24px 0' }}>
            {stage === 'verify'
              ? `Enter the six-digit code sent to ${email}.`
              : 'We will email you a six-digit reset code.'}
          </p>

          {message && (
            <div role="status" style={{
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

          {stage === 'request' ? (
            <form onSubmit={submitRequestCode}>
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
                {busy ? 'Sending...' : 'Send reset code'}
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={setNewPassword}>
                <input
                  style={input}
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  aria-label="Email address"
                />
                <input
                  style={input}
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Six-digit code"
                  aria-label="Six-digit email code"
                />
                <input
                  style={input}
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="New password"
                  autoComplete="new-password"
                />
                <input
                  style={input}
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                />
                <button style={button} type="submit" disabled={busy}>
                  {busy ? 'Saving...' : 'Set my password'}
                </button>
              </form>
              <button
                type="button"
                disabled={busy}
                onClick={requestCode}
                style={{
                  width: '100%',
                  padding: '12px',
                  marginTop: '10px',
                  background: 'transparent',
                  border: 0,
                  color: '#0047CC',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: busy ? 'not-allowed' : 'pointer'
                }}
              >
                Resend code
              </button>
            </>
          )}

          <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '20px', textAlign: 'center' }}>
            <Link href="/login" style={{ color: '#0047CC', textDecoration: 'none', fontWeight: 600 }}>
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
