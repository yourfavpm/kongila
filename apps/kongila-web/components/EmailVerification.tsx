/**
 * Email verification by typed code.
 *
 * Supabase issues the code and validates it; Resend delivers it through
 * custom SMTP using the Kongila template. Nothing here generates or stores a
 * code of its own — an OTP you implement yourself is an OTP you have to get
 * right on replay, expiry, brute force and rate limiting, and Supabase has
 * already done that.
 *
 * The flow this fits into matters. With email confirmation switched on,
 * `signUp` returns no session: the account exists but nobody is signed in
 * yet. Any authenticated call made at that moment comes back 401, which is
 * why provisioning has to wait until after this screen rather than running
 * immediately after signup. `verifyOtp` returns the session, and that is the
 * first moment the rest of the flow can do anything on the user's behalf.
 */

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Mascot } from '@kongila/ui';

const CODE_LENGTH = 6;

/** Supabase allows one confirmation email per user per 60 seconds. */
const RESEND_COOLDOWN_SECONDS = 60;

export interface EmailVerificationProps {
  email: string;
  /** Called once the code is accepted and a session exists. */
  onVerified: () => void | Promise<void>;
  /** Lets someone correct a typo in their address without starting over. */
  onChangeEmail?: () => void;
}

export default function EmailVerification({ email, onVerified, onChangeEmail }: EmailVerificationProps) {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [status, setStatus] = useState<'idle' | 'verifying' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => { inputs.current[0]?.focus(); }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const code = digits.join('');

  const submit = async (value: string) => {
    if (value.length !== CODE_LENGTH || status === 'verifying') return;
    setStatus('verifying');
    setMessage(null);

    try {
      // 'email' is the type for a signup code, not 'signup'. The latter is
      // not a value this accepts and fails with an unhelpful message.
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: value,
        type: 'email'
      });

      if (error) {
        setStatus('error');
        setMessage(
          /expired/i.test(error.message)
            ? 'That code has expired. Send a new one below.'
            : /invalid|incorrect/i.test(error.message)
              ? 'That code is not right. Check the email and try again.'
              : error.message
        );
        setDigits(Array(CODE_LENGTH).fill(''));
        inputs.current[0]?.focus();
        return;
      }

      if (!data?.session) {
        // Verified, but no session came back. That happens when the person
        // was already signed in on an unconfirmed account: the confirmation
        // lands on the existing session rather than issuing a new one, so
        // check for one before calling this a failure.
        const { data: existing } = await supabase.auth.getSession();
        if (!existing?.session) {
          setStatus('error');
          setMessage('Your email is verified, but we could not sign you in. Try signing in now.');
          return;
        }
      }

      setStatus('done');
      await onVerified();
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || 'That code could not be checked. Try again.');
    }
  };

  const setDigit = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    if (!cleaned) {
      setDigits(d => { const next = [...d]; next[index] = ''; return next; });
      return;
    }

    // A pasted code fills the row rather than landing entirely in one box.
    if (cleaned.length > 1) {
      const next = Array(CODE_LENGTH).fill('');
      cleaned.slice(0, CODE_LENGTH).split('').forEach((c, i) => { next[i] = c; });
      setDigits(next);
      const filled = Math.min(cleaned.length, CODE_LENGTH);
      inputs.current[Math.min(filled, CODE_LENGTH - 1)]?.focus();
      if (filled === CODE_LENGTH) submit(next.join(''));
      return;
    }

    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    if (index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
    if (next.every(Boolean)) submit(next.join(''));
  };

  const onKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') submit(code);
  };

  const resend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) {
        setMessage(
          /rate|limit|seconds/i.test(error.message)
            ? 'That was too soon. Wait a moment and try again.'
            : error.message
        );
      } else {
        setMessage(`A new code is on its way to ${email}.`);
        setCooldown(RESEND_COOLDOWN_SECONDS);
      }
    } catch (err: any) {
      setMessage(err?.message || 'That code could not be sent again.');
    } finally {
      setResending(false);
    }
  };

  const mascotState =
    status === 'done' ? 'congratulations'
    : status === 'error' ? 'failed'
    : status === 'verifying' ? 'loading'
    : 'thinking';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        background: 'radial-gradient(900px 400px at 50% -10%, rgba(0,71,204,0.06), transparent 70%)'
      }}
    >
      <div style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
        <Mascot state={mascotState as any} size={84} label="" style={{ marginBottom: 20 }} />

        <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: '#0E1726', margin: '0 0 10px' }}>
          {status === 'done' ? 'Verified' : 'Check your email'}
        </h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#526180', margin: '0 0 28px' }}>
          {status === 'done'
            ? 'Taking you to the next step.'
            : <>We sent a {CODE_LENGTH}-digit code to <strong style={{ color: '#0E1726' }}>{email}</strong>.</>}
        </p>

        {status !== 'done' && (
          <>
            <div
              style={{ display: 'flex', gap: 9, justifyContent: 'center', marginBottom: 20 }}
              onPaste={e => {
                const text = e.clipboardData.getData('text');
                if (/\d/.test(text)) { e.preventDefault(); setDigit(0, text); }
              }}
            >
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { inputs.current[i] = el; }}
                  value={digit}
                  onChange={e => setDigit(i, e.target.value)}
                  onKeyDown={e => onKeyDown(i, e)}
                  inputMode="numeric"
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  maxLength={CODE_LENGTH}
                  aria-label={`Digit ${i + 1}`}
                  disabled={status === 'verifying'}
                  style={{
                    width: 50,
                    height: 58,
                    textAlign: 'center',
                    fontSize: 22,
                    fontWeight: 600,
                    color: '#0E1726',
                    borderRadius: 11,
                    border: `1.5px solid ${status === 'error' ? '#F2706B' : digit ? '#0047CC' : '#DDE2EC'}`,
                    background: status === 'verifying' ? '#F6F8FC' : '#fff',
                    outline: 'none',
                    transition: 'border-color 140ms ease'
                  }}
                />
              ))}
            </div>

            {message && (
              <p
                role="status"
                style={{
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  color: status === 'error' ? '#C0392F' : '#0039A6',
                  margin: '0 0 20px'
                }}
              >
                {message}
              </p>
            )}

            <button
              type="button"
              onClick={() => submit(code)}
              disabled={code.length !== CODE_LENGTH || status === 'verifying'}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 10,
                border: 'none',
                fontSize: 15,
                fontWeight: 600,
                color: '#fff',
                cursor: code.length === CODE_LENGTH && status !== 'verifying' ? 'pointer' : 'not-allowed',
                background: code.length === CODE_LENGTH ? '#0047CC' : '#9FB4D8',
                marginBottom: 18
              }}
            >
              {status === 'verifying' ? 'Checking…' : 'Verify email'}
            </button>

            <div style={{ fontSize: 13, color: '#6B7A99' }}>
              {cooldown > 0 ? (
                <>You can request another code in {cooldown}s</>
              ) : (
                <button
                  type="button"
                  onClick={resend}
                  disabled={resending}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    font: 'inherit',
                    color: '#0047CC',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {resending ? 'Sending…' : 'Send a new code'}
                </button>
              )}
            </div>

            {onChangeEmail && (
              <button
                type="button"
                onClick={onChangeEmail}
                style={{
                  marginTop: 14,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  font: 'inherit',
                  fontSize: 13,
                  color: '#6B7A99',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: 3
                }}
              >
                Use a different email address
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
