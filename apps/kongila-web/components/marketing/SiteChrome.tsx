/**
 * The header, the footer and the page shell every public page sits in.
 *
 * Two jobs beyond looking right. The first is that a visitor should never
 * have to work out which of the two doors is theirs: the header carries both
 * at all times, Get Started for employers and Join as Talent for
 * professionals, and they keep the same words and the same colours on every
 * page. The second is that the public site and the portal must agree on
 * where things live, which is why every link here comes from siteMap.
 */

import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  SOLUTIONS,
  PLATFORM_PAGES,
  LEGAL_PAGES,
  startRequestHref,
  JOIN_TALENT_HREF,
  SIGN_IN_HREF
} from './siteMap';

/* ─── Logo ────────────────────────────────────────────────────────────── */

export function KongilaWordmark({ height = 36, inverted = false }: { height?: number; inverted?: boolean }) {
  return (
    <img
      src={inverted ? '/images/kongilainverted.png' : '/images/kongilalogo.png'}
      alt="Kongila"
      style={{ height, width: 'auto', objectFit: 'contain', display: 'block' }}
    />
  );
}

/* ─── Reveal on scroll ────────────────────────────────────────────────── */

/**
 * Adds the class that plays a section's one rise into view, then stops
 * watching it. Sections already on screen at load are shown immediately so
 * nothing above the fold waits for an observer to fire.
 */
export function useReveal() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll('.mk-reveal'));
    if (nodes.length === 0) return;

    if (typeof IntersectionObserver === 'undefined') {
      nodes.forEach(n => n.classList.add('is-in'));
      return;
    }

    const io = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    nodes.forEach(n => io.observe(n));
    return () => io.disconnect();
  }, []);
}

/* ─── Header ──────────────────────────────────────────────────────────── */

interface MenuColumn {
  label: string;
  items: { href: string; name: string; summary?: string; colour?: string }[];
}

const SOLUTIONS_MENU: MenuColumn = {
  label: 'Solutions',
  items: SOLUTIONS.map(s => ({
    href: `/solutions/${s.slug}`,
    name: s.name,
    summary: s.summary,
    colour: s.colour
  }))
};

const PLATFORM_MENU: MenuColumn = {
  label: 'Platform',
  items: PLATFORM_PAGES.map(p => ({ href: `/platform/${p.slug}`, name: p.name, summary: p.summary }))
};

export function SiteHeader() {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lifted, setLifted] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // A menu left open behind a navigation is the most common way these go
  // wrong, so both close whenever the route changes.
  useEffect(() => {
    setOpen(null);
    setMobileOpen(false);
  }, [router.asPath]);

  // Escape closes, and a click outside closes. Both expected, neither free.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(null); setMobileOpen(false); } };
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, []);

  const isActive = (href: string) =>
    router.asPath === href || (href !== '/' && router.asPath.startsWith(href));

  const linkStyle = (href: string): React.CSSProperties => ({
    fontSize: 14,
    fontWeight: 500,
    color: isActive(href) ? 'var(--kongila-blue)' : '#33415C',
    textDecoration: 'none',
    padding: '8px 2px'
  });

  return (
    <header
      ref={navRef as any}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 60,
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'saturate(180%) blur(12px)',
        borderBottom: `1px solid ${lifted ? '#E4E9F2' : 'transparent'}`,
        transition: 'border-color 200ms ease'
      }}
    >
      <div
        className="mk-wrap"
        style={{ display: 'flex', alignItems: 'center', gap: 30, height: 78 }}
      >
        <Link href="/" aria-label="Kongila home" style={{ display: 'flex', alignItems: 'center' }}>
          <KongilaWordmark height={34} />
        </Link>

        {/* Desktop navigation */}
        <nav className="mk-nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 22, flex: 1 }}>
          {[SOLUTIONS_MENU, PLATFORM_MENU].map(menu => (
            <div key={menu.label} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setOpen(open === menu.label ? null : menu.label)}
                aria-expanded={open === menu.label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  font: 'inherit',
                  fontSize: 14,
                  fontWeight: 500,
                  color: open === menu.label ? 'var(--kongila-blue)' : '#33415C',
                  padding: '8px 2px'
                }}
              >
                {menu.label}
                <span
                  aria-hidden
                  style={{
                    fontSize: 9,
                    transform: open === menu.label ? 'rotate(180deg)' : 'none',
                    transition: 'transform 160ms ease'
                  }}
                >
                  ▼
                </span>
              </button>

              {open === menu.label && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 12px)',
                    left: -16,
                    width: menu.label === 'Solutions' ? 460 : 480,
                    background: '#fff',
                    border: '1px solid #E4E9F2',
                    borderRadius: 16,
                    boxShadow: '0 18px 48px rgba(14,23,38,0.12)',
                    padding: 10,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 2
                  }}
                >
                  {menu.items.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      style={{
                        display: 'block',
                        padding: '12px 14px',
                        borderRadius: 10,
                        textDecoration: 'none',
                        transition: 'background 140ms ease'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F6F8FC')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {item.colour && (
                        <span
                          className="mk-indicator"
                          style={{ background: item.colour, marginBottom: 8, display: 'block' }}
                        />
                      )}
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#0E1726' }}>
                        {item.name}
                      </span>
                      {item.summary && (
                        <span style={{ display: 'block', marginTop: 3, fontSize: 12.5, lineHeight: 1.5, color: '#6B7A99' }}>
                          {item.summary}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          <Link href="/talent" style={linkStyle('/talent')}>Talent</Link>
          <Link href="/enterprise" style={linkStyle('/enterprise')}>Enterprise</Link>
          <Link href="/how-it-works" style={linkStyle('/how-it-works')}>How It Works</Link>
        </nav>

        {/* Both doors, always visible. */}
        <div className="mk-nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href={SIGN_IN_HREF} style={{ ...linkStyle(SIGN_IN_HREF), marginRight: 4 }}>Sign in</Link>
          <Link href={JOIN_TALENT_HREF} className="mk-btn mk-btn--ghost" style={{ padding: '10px 16px', fontSize: 14 }}>
            Join as Talent
          </Link>
          <Link href={startRequestHref()} className="mk-btn mk-btn--primary" style={{ padding: '10px 18px', fontSize: 14 }}>
            Get Started
          </Link>
        </div>

        {/* Mobile trigger */}
        <button
          type="button"
          className="mk-nav-mobile"
          onClick={() => setMobileOpen(v => !v)}
          aria-expanded={mobileOpen}
          aria-label="Menu"
          style={{
            display: 'none',
            marginLeft: 'auto',
            background: 'none',
            border: '1px solid #E4E9F2',
            borderRadius: 9,
            padding: '8px 10px',
            cursor: 'pointer',
            lineHeight: 0
          }}
        >
          <span style={{ display: 'block', width: 16, height: 1.5, background: '#33415C', marginBottom: 4 }} />
          <span style={{ display: 'block', width: 16, height: 1.5, background: '#33415C', marginBottom: 4 }} />
          <span style={{ display: 'block', width: 16, height: 1.5, background: '#33415C' }} />
        </button>
      </div>

      {mobileOpen && (
        <div style={{ borderTop: '1px solid #E4E9F2', background: '#fff', maxHeight: '76vh', overflowY: 'auto' }}>
          <div className="mk-wrap" style={{ padding: '18px 24px 26px' }}>
            <MobileGroup label="Solutions" items={SOLUTIONS_MENU.items} />
            <MobileGroup label="Platform" items={PLATFORM_MENU.items} />
            <div style={{ display: 'grid', gap: 2, marginTop: 10 }}>
              {[['/talent', 'Talent'], ['/enterprise', 'Enterprise'], ['/how-it-works', 'How It Works'], ['/about', 'About']].map(
                ([href, name]) => (
                  <Link key={href} href={href} style={{ padding: '11px 0', fontSize: 15, fontWeight: 500, color: '#0E1726', textDecoration: 'none' }}>
                    {name}
                  </Link>
                )
              )}
            </div>
            <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
              <Link href={startRequestHref()} className="mk-btn mk-btn--primary mk-btn--block">Get Started</Link>
              <Link href={JOIN_TALENT_HREF} className="mk-btn mk-btn--ghost mk-btn--block">Join as Talent</Link>
              <Link href={SIGN_IN_HREF} className="mk-btn mk-btn--quiet" style={{ justifyContent: 'center' }}>Sign in</Link>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @media (max-width: 1040px) {
          :global(.mk-nav-desktop) { display: none !important; }
          .mk-nav-mobile { display: block !important; }
        }
      `}</style>
    </header>
  );
}

function MobileGroup({ label, items }: { label: string; items: MenuColumn['items'] }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="mk-eyebrow" style={{ marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'grid', gap: 2 }}>
        {items.map(item => (
          <Link
            key={item.href}
            href={item.href}
            style={{ padding: '9px 0', fontSize: 14.5, color: '#33415C', textDecoration: 'none' }}
          >
            {item.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ─── Footer ──────────────────────────────────────────────────────────── */

export function SiteFooter() {
  return (
    <footer style={{ background: '#0B1222', color: '#9FB0CC', paddingTop: 64, paddingBottom: 40, marginTop: 0 }}>
      <div className="mk-wrap">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 1.4fr) repeat(4, minmax(0, 1fr))',
            gap: 36
          }}
          className="mk-footer-grid"
        >
          <div>
            <KongilaWordmark height={34} inverted />
            <p style={{ margin: '16px 0 0', fontSize: 13.5, lineHeight: 1.65, color: '#8395B5', maxWidth: 260 }}>
              Global workforce infrastructure. Hiring, compliance and payroll in one place, so you can
              build a team without building the operation behind it.
            </p>
          </div>

          <FooterColumn
            title="Solutions"
            links={SOLUTIONS.map(s => ({ href: `/solutions/${s.slug}`, name: s.name }))}
          />
          <FooterColumn
            title="Platform"
            links={PLATFORM_PAGES.map(p => ({ href: `/platform/${p.slug}`, name: p.name }))}
          />
          <FooterColumn
            title="Company"
            links={[
              { href: '/about', name: 'About Kongila' },
              { href: '/how-it-works', name: 'How It Works' },
              { href: '/enterprise', name: 'Enterprise' },
              { href: '/talent', name: 'For Professionals' }
            ]}
          />
          <FooterColumn
            title="Legal"
            links={LEGAL_PAGES.map(l => ({ href: `/legal/${l.slug}`, name: l.name }))}
          />
        </div>

        <div
          style={{
            marginTop: 48,
            paddingTop: 22,
            borderTop: '1px solid #1C2840',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 14,
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ fontSize: 12.5, color: '#6F82A3' }}>
            © {new Date().getFullYear()} Kongila. All rights reserved.
          </span>
          <div style={{ display: 'flex', gap: 18 }}>
            <Link href={startRequestHref()} style={{ fontSize: 12.5, color: '#9FB0CC', textDecoration: 'none' }}>
              Get Started
            </Link>
            <Link href={JOIN_TALENT_HREF} style={{ fontSize: 12.5, color: '#9FB0CC', textDecoration: 'none' }}>
              Join as Talent
            </Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 980px) {
          :global(.mk-footer-grid) { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 560px) {
          :global(.mk-footer-grid) { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { href: string; name: string }[] }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64789B', marginBottom: 14 }}>
        {title}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            style={{ fontSize: 13.5, color: '#9FB0CC', textDecoration: 'none' }}
          >
            {l.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ─── Page shell ──────────────────────────────────────────────────────── */

export interface MarketingPageProps {
  title: string;
  description: string;
  children: React.ReactNode;
  /** Set false on pages that supply their own chrome, such as 404. */
  chrome?: boolean;
}

export function MarketingPage({ title, description, children, chrome = true }: MarketingPageProps) {
  useReveal();
  return (
    <div className="mk-shell">
      <Head>
        <title>{`${title} · Kongila`}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/images/kongilalogo.png" />
      </Head>
      {chrome && <SiteHeader />}
      <main>{children}</main>
      {chrome && <SiteFooter />}
    </div>
  );
}

export default MarketingPage;
