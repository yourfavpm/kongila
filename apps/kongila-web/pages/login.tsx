/**
 * One door in, two doors out.
 *
 * Clients and professionals sign in at the same place — they are both just
 * people with an account, and asking them to pick a portal before they have
 * proved who they are is a decision the system can make itself. On success
 * this lands on "/", where the existing session logic reads the role and
 * routes to the right dashboard.
 *
 * Underneath sit the two ways to get an account in the first place, because
 * the people who end up here without one are the ones most likely to give up.
 * They are deliberately not symmetrical:
 *
 *   A professional applies — an account, then vetting.
 *   A client does not sign up at all. They file a service request, and the
 *     account is created as part of it.
 *
 * So the client button says Hire Talent and opens the request, not a signup
 * form. Offering a client a "create account" button here would put them in a
 * flow that does not exist.
 */

import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import Mascot from '../components/brand/Mascot';
import { KongilaWordmark } from '../components/marketing/SiteChrome';
import { startRequestHref, JOIN_TALENT_HREF } from '../components/marketing/siteMap';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  /** Where to land afterwards. Only same-site paths, so ?next= cannot be
      used to bounce someone to another domain after they sign in. */
  const destination = (): string => {
    const raw = router.query.next;
    const next = Array.isArray(raw) ? raw[0] : raw;
    if (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')) return next;
    return '/';
  };

  // Already signed in? Do not make them do it twice.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then((result: any) => {
      if (cancelled) return;
      if (result?.data?.session?.user) router.replace(destination());
      else setChecking(false);
    }).catch(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const address = email.trim();
    if (!address || !password) {
      setError('Enter your email address and password.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: address,
        password
      });
      if (authError) {
        // Supabase says "Invalid login credentials" for a wrong password and
        // for an address with no account. Repeating that verbatim tells an
        // attacker which addresses are registered, so it stays one message.
        setError(
          /invalid login/i.test(authError.message)
            ? 'That email and password do not match an account.'
            : authError.message
        );
        setSubmitting(false);
        return;
      }
      router.replace(destination());
    } catch (err: any) {
      setError(err?.message || 'Could not sign you in. Try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="mk-shell" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Head>
        <title>Sign in · Kongila</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <link rel="icon" href="/images/kongilalogo.png" />
      </Head>

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          background: 'radial-gradient(900px 400px at 50% -10%, rgba(0,71,204,0.06), transparent 70%)'
        }}
      >
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: 30 }}>
            <Link href="/" aria-label="Kongila home" style={{ display: 'inline-block', marginBottom: 26 }}>
              <KongilaWordmark height={28} />
            </Link>
            <h1 className="mk-h2" style={{ fontSize: 26, marginBottom: 8 }}>Welcome back</h1>
            <p className="mk-small">Sign in to your Kongila account.</p>
          </div>

          {checking ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <Mascot state="loading" size={56} label="Checking your session" />
            </div>
          ) : (
            <form
              onSubmit={submit}
              style={{
                background: '#fff',
                border: '1px solid var(--mk-rule)',
                borderRadius: 16,
                padding: 26,
                boxShadow: '0 12px 36px rgba(14,23,38,0.05)'
              }}
            >
              {error && (
                <div
                  role="alert"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    padding: '11px 13px',
                    borderRadius: 10,
                    background: '#FEF2F2',
                    border: '1px solid #FBD5D3',
                    marginBottom: 18
                  }}
                >
                  <Mascot state="failed" size={30} label="" />
                  <span style={{ fontSize: 13, color: '#B4302A', lineHeight: 1.5 }}>{error}</span>
                </div>
              )}

              <Field label="Email address" htmlFor="login-email">
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  style={inputStyle}
                />
              </Field>

              <Field
                label="Password"
                htmlFor="login-password"
                aside={
                  <Link href="/reset-password" style={{ fontSize: 12.5, color: 'var(--kongila-blue)', textDecoration: 'none' }}>
                    Forgot password?
                  </Link>
                }
              >
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ ...inputStyle, paddingRight: 64 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#6B7A99'
                    }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </Field>

              <button
                type="submit"
                disabled={submitting}
                className="mk-btn mk-btn--primary mk-btn--block"
                style={{ marginTop: 6, opacity: submitting ? 0.75 : 1, cursor: submitting ? 'wait' : 'pointer' }}
              >
                {submitting ? (
                  <>
                    <Mascot state="loading" size={20} label="" />
                    Signing you in
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>
          )}

          {/* The two ways to get an account. */}
          <div style={{ marginTop: 26 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                margin: '0 0 18px',
                color: '#9AA8C2',
                fontSize: 12
              }}
            >
              <span style={{ flex: 1, height: 1, background: 'var(--mk-rule)' }} />
              New to Kongila?
              <span style={{ flex: 1, height: 1, background: 'var(--mk-rule)' }} />
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <DoorButton
                href={JOIN_TALENT_HREF}
                colour="#0047CC"
                title="Apply as Talent"
                detail="Build a profile, get verified, get matched to roles."
              />
              <DoorButton
                href={startRequestHref()}
                colour="#0ABFBC"
                title="Hire Talent"
                detail="Tell us what you need. Your account is created with the request."
              />
            </div>
          </div>

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12.5, color: '#9AA8C2' }}>
            <Link href="/" style={{ color: '#6B7A99', textDecoration: 'none' }}>← Back to kongila.com</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 13px',
  fontSize: 14.5,
  borderRadius: 10,
  border: '1px solid #DDE2EC',
  background: '#FBFCFE',
  color: '#0E1726',
  outline: 'none'
};

function Field({
  label,
  htmlFor,
  aside,
  children
}: {
  label: string;
  htmlFor: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
        <label htmlFor={htmlFor} style={{ fontSize: 12.5, fontWeight: 600, color: '#33415C' }}>
          {label}
        </label>
        {aside}
      </div>
      {children}
    </div>
  );
}

function DoorButton({
  href,
  colour,
  title,
  detail
}: {
  href: string;
  colour: string;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="mk-card mk-card--link"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '15px 17px',
        textDecoration: 'none'
      }}
    >
      <span style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: colour, flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: '#0E1726' }}>{title}</span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 12.5, lineHeight: 1.5, color: '#6B7A99' }}>
          {detail}
        </span>
      </span>
      <span aria-hidden style={{ color: colour, fontSize: 16 }}>→</span>
    </Link>
  );
}
