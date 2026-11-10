/**
 * The page that is not there.
 *
 * Kon comes apart. The mascot is a folded sheet everywhere else in the
 * product, so the one place it lies flat and creased is the one place
 * something has gone wrong — which makes the joke carry the meaning instead
 * of decorating it.
 *
 * The button goes back where the person came from, because that is almost
 * always what they want and almost never what a 404 offers. router.back()
 * alone is a trap: arrive here from a pasted link or a bookmark and there is
 * no history to go back to, so the button does nothing. This checks first and
 * falls back to the homepage.
 */

import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Mascot from '../components/brand/Mascot';
import { SiteHeader, SiteFooter } from '../components/marketing/SiteChrome';
import { startRequestHref, JOIN_TALENT_HREF } from '../components/marketing/siteMap';

export default function NotFound() {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    // history.length > 1 means this tab has somewhere to return to. A fresh
    // tab opened on a dead link has length 1, and for those the button says
    // "Take me home" rather than lying about going back.
    setCanGoBack(typeof window !== 'undefined' && window.history.length > 1);
  }, []);

  const goBack = () => {
    if (canGoBack) router.back();
    else router.push('/');
  };

  return (
    <div className="mk-shell">
      <Head>
        <title>Came unfolded · Kongila</title>
        <meta name="robots" content="noindex" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/images/kongilalogo.png" />
      </Head>

      <SiteHeader />

      <main>
        <section
          style={{
            minHeight: '64vh',
            display: 'flex',
            alignItems: 'center',
            padding: 'clamp(48px, 8vw, 96px) 0',
            background:
              'radial-gradient(1100px 420px at 50% -8%, rgba(0,71,204,0.07), transparent 70%)'
          }}
        >
          <div className="mk-wrap" style={{ textAlign: 'center', maxWidth: 640 }}>
            <Mascot state="lost" size={132} label="" style={{ marginBottom: 26 }} />

            <div className="mk-eyebrow" style={{ marginBottom: 12 }}>Error 404</div>

            <h1 className="mk-h1" style={{ marginBottom: 16 }}>
              This one came unfolded.
            </h1>

            <p className="mk-lede" style={{ marginBottom: 32, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
              The page you were after has moved, been renamed, or never existed.
              Nothing you did caused it.
            </p>

            <div
              style={{
                display: 'flex',
                gap: 12,
                justifyContent: 'center',
                flexWrap: 'wrap',
                marginBottom: 44
              }}
            >
              <button type="button" onClick={goBack} className="mk-btn mk-btn--primary">
                {canGoBack ? 'Back to where you were' : 'Take me home'}
              </button>
              {canGoBack && (
                <Link href="/" className="mk-btn mk-btn--ghost">Go to homepage</Link>
              )}
            </div>

            <div
              style={{
                borderTop: '1px solid var(--mk-rule)',
                paddingTop: 26,
                display: 'flex',
                gap: 26,
                justifyContent: 'center',
                flexWrap: 'wrap'
              }}
            >
              <QuietLink href={startRequestHref()} label="Hire talent" />
              <QuietLink href={JOIN_TALENT_HREF} label="Join as talent" />
              <QuietLink href="/how-it-works" label="How Kongila works" />
              <QuietLink href="/about" label="About us" />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function QuietLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--kongila-blue)', textDecoration: 'none' }}
    >
      {label} →
    </Link>
  );
}
