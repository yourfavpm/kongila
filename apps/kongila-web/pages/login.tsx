import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
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

  const destination = (): string => {
    const raw = router.query.next;
    const next = Array.isArray(raw) ? raw[0] : raw;
    if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) return '/?workspace=1';
    return next === '/' ? '/?workspace=1' : next;
  };

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then((result: any) => {
      if (cancelled) return;
      if (result?.data?.session?.user) router.replace(destination());
      else setChecking(false);
    }).catch(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
    // Keep the initial session check one-shot; next is read when redirecting.
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
      const { error: authError } = await supabase.auth.signInWithPassword({ email: address, password });
      if (authError) {
        setError(/invalid login/i.test(authError.message)
          ? 'That email and password do not match an account.'
          : authError.message);
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
    <main className="auth-experience">
      <Head>
        <title>Sign in · Kongila</title>
        <meta name="robots" content="noindex" />
        <meta name="theme-color" content="#f6f4ee" />
        <link rel="icon" href="/images/kongilalogo.png" />
      </Head>

      <section className="auth-brand" aria-labelledby="auth-brand-title">
        <div className="auth-brand-inner">
          <Link href="/" className="auth-brand-logo" aria-label="Kongila home">
            <KongilaWordmark height={34} />
          </Link>
          <div className="auth-brand-copy">
            <p className="auth-eyebrow"><span /> WORKFORCE, CONNECTED</p>
            <h1 id="auth-brand-title">Your workforce<br />journey starts here.</h1>
            <p className="auth-brand-description">
              One connected platform for finding talent, managing employment and building teams that move work forward.
            </p>
          </div>
          <WorkforceIllustration />
          <div className="auth-brand-footnote">
            <span className="auth-footnote-mark" aria-hidden="true">K</span>
            <span>People, processes and possibility<br />moving in the same direction.</span>
          </div>
        </div>
      </section>

      <section className="auth-entry" aria-labelledby="auth-title">
        <div className="auth-entry-inner">
          <div className="auth-mobile-brand">
            <Link href="/" aria-label="Kongila home"><KongilaWordmark height={30} /></Link>
            <span>WORKFORCE, CONNECTED</span>
          </div>

          <div className="auth-heading">
            <p className="auth-eyebrow auth-eyebrow-blue">YOUR KONGILA WORKSPACE</p>
            <h2 id="auth-title">Welcome back.</h2>
            <p>Sign in to continue to your Kongila workspace.</p>
          </div>

          {checking ? (
            <div className="auth-loading" role="status" aria-live="polite">
              <span className="auth-spinner" aria-hidden="true" />
              <span>Checking your session…</span>
            </div>
          ) : (
            <form className="auth-form" onSubmit={submit} noValidate>
              {error && <div className="auth-error" role="alert"><span aria-hidden="true">!</span>{error}</div>}

              <div className="auth-field">
                <label htmlFor="login-email">Email address</label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  aria-invalid={Boolean(error)}
                  required
                />
              </div>

              <div className="auth-field">
                <div className="auth-label-row">
                  <label htmlFor="login-password">Password</label>
                  <Link href="/reset-password">Forgot password?</Link>
                </div>
                <div className="auth-password-wrap">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    aria-invalid={Boolean(error)}
                    required
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button className="auth-submit" type="submit" disabled={submitting}>
                {submitting ? <><span className="auth-button-spinner" aria-hidden="true" /> Signing you in…</> : <>Sign in <span aria-hidden="true">→</span></>}
              </button>
            </form>
          )}

          <div className="auth-signup" aria-labelledby="signup-title">
            <div className="auth-signup-heading">
              <div>
                <h3 id="signup-title">New to Kongila?</h3>
                <p>Choose how you would like to get started.</p>
              </div>
              <span className="auth-signup-rule" aria-hidden="true" />
            </div>
            <div className="auth-pathways">
              <RegistrationPathway
                href={JOIN_TALENT_HREF}
                kind="talent"
                title="I'm looking for opportunities"
                description="Join the talent network and explore professional opportunities."
                action="Apply as Talent"
              />
              <RegistrationPathway
                href={startRequestHref()}
                kind="client"
                title="I'm looking to hire"
                description="Tell us about your organisation and the talent you need."
                action="Hire Talent"
              />
            </div>
          </div>

          <Link href="/" className="auth-back">← <span>Back to kongila.com</span></Link>
        </div>
      </section>
    </main>
  );
}

function WorkforceIllustration() {
  return (
    <div className="auth-illustration" aria-hidden="true">
      <svg className="auth-illustration-lines" viewBox="0 0 620 410" fill="none">
        <path d="M171 116C229 92 246 129 299 155M407 107C355 105 350 139 321 158M176 286C234 290 251 254 298 236M430 285C380 278 360 251 326 235" stroke="#77A7D4" strokeWidth="1.5" strokeDasharray="5 7" />
        <circle cx="171" cy="116" r="4" fill="#0A5CC4"/><circle cx="407" cy="107" r="4" fill="#0A5CC4"/><circle cx="176" cy="286" r="4" fill="#0A5CC4"/><circle cx="430" cy="285" r="4" fill="#0A5CC4"/>
      </svg>
      <div className="auth-illustration-orbit auth-orbit-one" />
      <div className="auth-illustration-orbit auth-orbit-two" />
      <div className="auth-network-core">
        <div className="auth-core-icon"><svg viewBox="0 0 48 48" fill="none"><path d="M10 32V18l14-8 14 8v14l-14 8-14-8Z" stroke="currentColor" strokeWidth="2"/><path d="m10 18 14 8 14-8M24 26v14" stroke="currentColor" strokeWidth="2"/><circle cx="24" cy="26" r="3" fill="currentColor"/></svg></div>
        <strong>One workforce</strong><span>Connected, by design</span>
      </div>
      <div className="auth-illustration-node auth-node-talent"><span className="auth-node-symbol"><PersonIcon /></span><span><b>Talent</b><small>Find the right fit</small></span><i>01</i></div>
      <div className="auth-illustration-node auth-node-employment"><span className="auth-node-symbol auth-node-symbol-blue"><DocumentIcon /></span><span><b>Employment</b><small>Manage with clarity</small></span><i>02</i></div>
      <div className="auth-illustration-node auth-node-operations"><span className="auth-node-symbol auth-node-symbol-gold"><OrbitIcon /></span><span><b>Operations</b><small>Keep work moving</small></span><i>03</i></div>
      <div className="auth-illustration-note"><span className="auth-note-check">✓</span><span>Built around<br /><b>people at work</b></span></div>
      <div className="auth-illustration-spark auth-spark-a" /><div className="auth-illustration-spark auth-spark-b" />
    </div>
  );
}

function RegistrationPathway({ href, kind, title, description, action }: {
  href: string; kind: 'talent' | 'client'; title: string; description: string; action: string;
}) {
  return (
    <Link href={href} className={`auth-pathway auth-pathway-${kind}`}>
      <div className="auth-pathway-art" aria-hidden="true">
        {kind === 'talent' ? <TalentPathwayArt /> : <ClientPathwayArt />}
      </div>
      <div className="auth-pathway-copy">
        <span className="auth-pathway-overline">{kind === 'talent' ? 'FOR PROFESSIONALS' : 'FOR ORGANISATIONS'}</span>
        <h4>{title}</h4>
        <p>{description}</p>
        <span className="auth-pathway-action">{action}<span aria-hidden="true">↗</span></span>
      </div>
    </Link>
  );
}

function TalentPathwayArt() {
  return <svg viewBox="0 0 250 112" fill="none"><circle cx="198" cy="51" r="48" fill="#D9E8F4"/><path d="M162 101c4-24 17-37 36-37s32 13 36 37" fill="#15324D"/><path d="M177 47c0-15 9-25 22-25s22 10 22 25v10c0 14-9 24-22 24s-22-10-22-24V47Z" fill="#BD8060"/><path d="M175 49c-1-21 10-31 25-31 15 0 25 12 22 31-7-2-13-7-17-13-7 7-17 11-30 13Z" fill="#1E3345"/><path d="M18 78h90M27 89h65" stroke="#A5B8C4" strokeWidth="2" strokeLinecap="round"/><rect x="24" y="32" width="81" height="35" rx="5" fill="#fff"/><path d="M35 45h38M35 54h27" stroke="#68839A" strokeWidth="2" strokeLinecap="round"/><circle cx="92" cy="49" r="6" fill="#2E8A77"/><path d="m89 49 2 2 4-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M136 26v15M128.5 33.5h15" stroke="#D7A949" strokeWidth="2" strokeLinecap="round"/></svg>;
}

function ClientPathwayArt() {
  return <svg viewBox="0 0 250 112" fill="none"><circle cx="197" cy="51" r="48" fill="#E8E4D9"/><path d="M163 102c4-23 16-37 34-37 19 0 32 14 36 37" fill="#D88140"/><path d="M180 49c0-15 8-24 18-24 12 0 20 9 20 24v9c0 14-8 23-20 23s-18-9-18-23v-9Z" fill="#9B6048"/><path d="M177 51c0-21 9-31 22-31 12 0 23 9 21 28-7-2-13-7-18-14-5 8-14 14-25 17Z" fill="#243644"/><rect x="18" y="33" width="91" height="56" rx="6" fill="#fff"/><path d="M18 45h91" stroke="#DDE3E5"/><path d="M30 58h31M30 67h45" stroke="#6F8790" strokeWidth="2" strokeLinecap="round"/><circle cx="88" cy="62" r="8" fill="#F1E5CD"/><path d="M84 62h8M88 58v8" stroke="#9A762D" strokeWidth="1.5" strokeLinecap="round"/><path d="M126 29h18M135 20v18" stroke="#0A5CC4" strokeWidth="2" strokeLinecap="round"/></svg>;
}

function PersonIcon() { return <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7"/><path d="M5 20c.6-4 3-6 7-6s6.4 2 7 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>; }
function DocumentIcon() { return <svg viewBox="0 0 24 24" fill="none"><path d="M7 3.8h7l4 4V20H7V3.8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M14 4v4h4M10 12h5M10 16h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>; }
function OrbitIcon() { return <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7"/><ellipse cx="12" cy="12" rx="9" ry="4.5" transform="rotate(-35 12 12)" stroke="currentColor" strokeWidth="1.5"/><circle cx="19.5" cy="7.3" r="1.5" fill="currentColor"/></svg>; }
