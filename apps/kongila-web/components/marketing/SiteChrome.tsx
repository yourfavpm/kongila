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
  items: [...PLATFORM_PAGES]
    .sort((a, b) => {
      const order = ['workforce-platform', 'talent-matching', 'compliance', 'payroll', 'workforce-operations', 'security'];
      return order.indexOf(a.slug) - order.indexOf(b.slug);
    })
    .map(p => ({ href: `/platform/${p.slug}`, name: p.name, summary: p.summary }))
};

export function SiteHeader({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const liftedRef = useRef(false);

  useEffect(() => {
    const onScroll = () => { liftedRef.current = window.scrollY > 8; };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [router.asPath]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenuOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const elements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter(element => element.offsetParent !== null);
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [menuOpen]);

  const isActive = (href: string) => router.asPath === href || (href !== '/' && router.asPath.startsWith(href));
  const closeMenu = () => {
    setMenuOpen(false);
    triggerRef.current?.focus();
  };
  const toggleGroup = (label: string) => setExpandedGroup(value => value === label ? null : label);

  return (
    <header className={`mk-site-header mk-header-premium${tone === 'dark' ? ' mk-site-header--dark' : ''}`}>
      <div className="mk-wrap mk-header-bar">
        <Link href="/" aria-label="Kongila home" className="mk-header-logo"><KongilaWordmark height={tone === 'dark' ? 62 : 46} inverted={tone === 'dark'} /></Link>
        <div className="mk-header-actions">
          <Link href={SIGN_IN_HREF} className="mk-header-signin">Sign in</Link>
          <Link href={startRequestHref()} className="mk-header-cta">Get Started <b>↗</b></Link>
          <button
            type="button"
            ref={triggerRef}
            className={`mk-nav-mobile${menuOpen ? ' is-open' : ''}`}
            onClick={() => {
              if (menuOpen) closeMenu();
              else {
                setExpandedGroup(router.asPath.startsWith('/solutions') ? 'Solutions' : router.asPath.startsWith('/platform') ? 'Platform' : null);
                setMenuOpen(true);
              }
            }}
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            aria-controls="kongila-navigation-overlay"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            <span className="mk-nav-mobile__icon" aria-hidden="true"><i/><i/></span>
            <span className="mk-nav-mobile__label">{menuOpen ? 'Close' : 'Menu'}</span>
          </button>
        </div>
      </div>

      <div
        id="kongila-navigation-overlay"
        className={`mk-menu-overlay${menuOpen ? ' is-open' : ''}`}
        aria-hidden={!menuOpen}
        onMouseDown={event => { if (event.target === event.currentTarget) closeMenu(); }}
      >
        <section className="mk-menu-dialog" role="dialog" aria-label="Kongila main navigation" aria-modal={menuOpen || undefined} ref={dialogRef as any}>
          <div className="mk-menu-header">
            <Link href="/" aria-label="Kongila home" className="mk-menu-logo" onClick={closeMenu}><KongilaWordmark height={44}/></Link>
            <div className="mk-menu-header__right"><span>MENU / NAVIGATION</span><button ref={closeRef} type="button" className="mk-menu-close" onClick={closeMenu} aria-label="Close navigation menu"><i/><i/><span>Close</span></button></div>
          </div>

          <div className="mk-menu-body">
            <nav className="mk-menu-primary" aria-label="Main navigation">
              <Link href="/" onClick={closeMenu} aria-current={isActive('/') ? 'page' : undefined}>Home</Link>
              <button type="button" onClick={() => toggleGroup('Solutions')} aria-expanded={expandedGroup === 'Solutions'}>Solutions <span>{expandedGroup === 'Solutions' ? '−' : '+'}</span></button>
              <button type="button" onClick={() => toggleGroup('Platform')} aria-expanded={expandedGroup === 'Platform'}>Platform <span>{expandedGroup === 'Platform' ? '−' : '+'}</span></button>
              <Link href="/about" onClick={closeMenu} aria-current={isActive('/about') ? 'page' : undefined}>About</Link>
              <Link href={startRequestHref()} onClick={closeMenu} aria-current={isActive('/get-started') ? 'page' : undefined}>Contact</Link>
            </nav>

            <div className={`mk-menu-group${expandedGroup ? ' is-expanded' : ''}`} aria-live="polite">
              {expandedGroup === 'Solutions' && <MenuLinkList menu={SOLUTIONS_MENU} isActive={isActive} onNavigate={closeMenu}/>}
              {expandedGroup === 'Platform' && <MenuLinkList menu={PLATFORM_MENU} isActive={isActive} onNavigate={closeMenu}/>}
              {!expandedGroup && <div className="mk-menu-group__intro"><span>EXPLORE KONGILA</span><p>Choose a path to see how the pieces of a global workforce come together.</p><Link href="/solutions" onClick={closeMenu}>Compare solutions <b>↗</b></Link></div>}
            </div>

            <aside className="mk-menu-featured">
              <div className="mk-menu-featured__art" aria-hidden="true"><svg viewBox="0 0 260 210"><path d="M130 104 48 45M130 104 212 45M130 104 48 164M130 104 212 164"/><circle cx="130" cy="104" r="31"/><circle cx="48" cy="45" r="4"/><circle cx="212" cy="45" r="4"/><circle cx="48" cy="164" r="4"/><circle cx="212" cy="164" r="4"/><rect x="118" y="92" width="24" height="24" rx="4"/></svg></div>
              <p className="mk-menu-featured__eyebrow">KONGILA / WORKFORCE INFRASTRUCTURE</p>
              <h2>Build a workforce that works for you.</h2>
              <p>Discover how Kongila connects talent, employment and workforce operations.</p>
              <Link href={startRequestHref()} className="mk-menu-featured__cta" onClick={closeMenu}>Talk to our team <b>↗</b></Link>
            </aside>
          </div>

          <footer className="mk-menu-footer"><p>Global workforce infrastructure.</p><div><Link href="mailto:support@kongila.com" onClick={closeMenu}>Contact Kongila</Link><Link href="/enterprise" onClick={closeMenu}>Enterprise</Link><Link href="/how-it-works" onClick={closeMenu}>How it works</Link><Link href="/talent" onClick={closeMenu}>For Professionals</Link><Link href={JOIN_TALENT_HREF} onClick={closeMenu}>Join as Talent</Link><Link href={SIGN_IN_HREF} onClick={closeMenu}>Sign in</Link></div><span>© {new Date().getFullYear()} Kongila</span></footer>
        </section>
      </div>
    </header>
  );
}

function MenuLinkList({menu,isActive,onNavigate}:{menu:MenuColumn;isActive:(href:string)=>boolean;onNavigate:()=>void}) {
  return <div className="mk-menu-link-list"><div className="mk-menu-link-list__head"><span>EXPLORE</span><b>{menu.label}</b>{menu.label === 'Solutions' && <Link href="/solutions" onClick={onNavigate}>Compare all <i>↗</i></Link>}</div><div className="mk-menu-link-list__items">{menu.items.map((item,index)=><Link key={item.href} href={item.href} onClick={onNavigate} className={isActive(item.href)?'is-active':''} aria-current={isActive(item.href)?'page':undefined}><span className="mk-menu-link-list__index">0{index+1}</span><span><b>{item.name}</b>{item.summary&&<small>{item.summary}</small>}</span><i aria-hidden="true">↗</i></Link>)}</div></div>;
}

export function SiteFooter() {
  return (
    <footer className="mk-site-footer" style={{ background: '#08152D', color: '#9FB0CC', paddingTop: 68, paddingBottom: 30, marginTop: 0 }}>
      <div className="mk-wrap">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 1.4fr) repeat(4, minmax(0, 1fr))',
            gap: 36
          }}
          className="mk-footer-grid"
        >
          <div className="mk-footer-brand">
            <KongilaWordmark height={102} inverted />
            <div style={{ marginTop: 22, color: '#F4F7FC', fontSize: 18, lineHeight: 1.35, fontWeight: 600, letterSpacing: '-.02em', maxWidth: 250 }}>
              Build globally.<br />Hire intelligently.
            </div>
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
          :global(.mk-footer-grid) { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          :global(.mk-footer-brand) { grid-column: 1 / -1; }
        }
      `}</style>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { href: string; name: string }[] }) {
  return (
    <div className="mk-footer-column">
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
