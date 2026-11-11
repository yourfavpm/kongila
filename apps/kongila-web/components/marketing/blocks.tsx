/**
 * The pieces every marketing page is assembled from.
 *
 * Twenty-odd pages written freehand drift within a week: one has 80px of
 * padding and the next has 64, one calls it "Talk to an Expert" and the next
 * "Speak to us". These blocks are the vocabulary, so a new page is a
 * composition rather than a redesign, and a change to how a section looks
 * happens in one place.
 *
 * Each block takes content and nothing else. None of them know which page
 * they are on.
 */

import React from 'react';
import Link from 'next/link';
import Mascot, { MascotState } from '../brand/Mascot';
import { startRequestHref, JOIN_TALENT_HREF } from './siteMap';

/* ─── Section wrapper ─────────────────────────────────────────────────── */

export function Section({
  children,
  tint,
  id,
  style
}: {
  children: React.ReactNode;
  tint?: boolean;
  id?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section id={id} className={`mk-section${tint ? ' mk-section--tint' : ''}`} style={style}>
      <div className="mk-wrap">{children}</div>
    </section>
  );
}

/** A centred heading block. `eyebrow` is optional and usually earns its place. */
export function SectionHead({
  eyebrow,
  title,
  lede,
  align = 'center',
  maxWidth = 620
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  align?: 'center' | 'left';
  maxWidth?: number;
}) {
  return (
    <div
      className="mk-reveal"
      style={{
        textAlign: align,
        maxWidth,
        margin: align === 'center' ? '0 auto 44px' : '0 0 40px'
      }}
    >
      {eyebrow && <div className="mk-eyebrow" style={{ marginBottom: 12 }}>{eyebrow}</div>}
      <h2 className="mk-h2">{title}</h2>
      {lede && <p className="mk-lede" style={{ marginTop: 14 }}>{lede}</p>}
    </div>
  );
}

/* ─── Hero ────────────────────────────────────────────────────────────── */

export interface HeroAction {
  href: string;
  label: string;
  kind?: 'primary' | 'ghost';
}

export function Hero({
  eyebrow,
  title,
  lede,
  actions = [],
  aside,
  footnote
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lede?: string;
  actions?: HeroAction[];
  aside?: React.ReactNode;
  footnote?: React.ReactNode;
}) {
  return (
    <section
      className="mk-hero"
      style={{
        padding: 'clamp(52px, 7vw, 92px) 0 clamp(44px, 6vw, 76px)',
        background: 'radial-gradient(1000px 440px at 12% -12%, rgba(0,71,204,0.07), transparent 68%)'
      }}
    >
      <div
        className="mk-wrap mk-hero-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: aside ? 'minmax(0, 1.02fr) minmax(0, 1fr)' : 'minmax(0, 1fr)',
          gap: 'clamp(32px, 5vw, 64px)',
          alignItems: 'center'
        }}
      >
        <div className="mk-reveal is-in" style={{ maxWidth: aside ? 560 : 780, minWidth: 0 }}>
          {eyebrow && <div className="mk-eyebrow" style={{ marginBottom: 16 }}>{eyebrow}</div>}
          <h1 className="mk-h1">{title}</h1>
          {lede && <p className="mk-lede" style={{ marginTop: 20, maxWidth: 560 }}>{lede}</p>}
          {actions.length > 0 && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 32 }}>
              {actions.map(a => (
                <Link
                  key={a.href + a.label}
                  href={a.href}
                  className={`mk-btn mk-btn--${a.kind || 'primary'}`}
                >
                  {a.label}
                </Link>
              ))}
            </div>
          )}
          {footnote && <div style={{ marginTop: 26 }}>{footnote}</div>}
        </div>
        {aside && <div className="mk-reveal is-in mk-hero-aside">{aside}</div>}
      </div>
    </section>
  );
}

/* ─── Cards ───────────────────────────────────────────────────────────── */

export function IndicatorCard({
  colour,
  title,
  body,
  href,
  cta
}: {
  colour: string;
  title: string;
  body: string;
  href?: string;
  cta?: string;
}) {
  const inner = (
    <>
      <span className="mk-indicator" style={{ background: colour, display: 'block' }} />
      <h3 className="mk-h3" style={{ marginBottom: 8 }}>{title}</h3>
      <p className="mk-body">{body}</p>
      {cta && (
        <span style={{ display: 'inline-block', marginTop: 16, fontSize: 13.5, fontWeight: 600, color: colour }}>
          {cta} →
        </span>
      )}
    </>
  );

  if (!href) return <div className="mk-card">{inner}</div>;
  return (
    <Link href={href} className="mk-card mk-card--link" style={{ textDecoration: 'none', display: 'block' }}>
      {inner}
    </Link>
  );
}

/** A plain capability tile — a small mark, a name, a line. */
export function CapabilityCard({ title, body, colour = '#0047CC' }: { title: string; body: string; colour?: string }) {
  return (
    <div className="mk-card">
      <span
        aria-hidden
        style={{
          display: 'block',
          width: 28,
          height: 28,
          borderRadius: 8,
          background: `${colour}14`,
          border: `1px solid ${colour}33`,
          marginBottom: 14
        }}
      />
      <h3 className="mk-h3" style={{ fontSize: 15.5, marginBottom: 6 }}>{title}</h3>
      <p className="mk-small">{body}</p>
    </div>
  );
}

/* ─── Process strip ───────────────────────────────────────────────────── */

/**
 * The horizontal stage strip. Used for the short version of a journey, where
 * the names alone carry it and prose would get in the way.
 */
export function StageStrip({ stages, colour = '#0047CC' }: { stages: string[]; colour?: string }) {
  return (
    <ol
      className="mk-reveal"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 10,
        listStyle: 'none',
        margin: 0,
        padding: 0
      }}
    >
      {stages.map((stage, i) => (
        <li key={stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 9,
              padding: '9px 15px',
              borderRadius: 999,
              border: '1px solid var(--mk-rule)',
              background: '#fff',
              fontSize: 13.5,
              fontWeight: 500,
              color: '#33415C',
              whiteSpace: 'nowrap'
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 3, background: colour }} />
            {stage}
          </span>
          {i < stages.length - 1 && <span aria-hidden style={{ color: '#C3CEE2', fontSize: 13 }}>→</span>}
        </li>
      ))}
    </ol>
  );
}

/** The numbered detail steps, for How It Works. */
export function NumberedStep({
  index,
  kicker,
  title,
  body,
  colour
}: {
  index: number;
  kicker: string;
  title: string;
  body: string;
  colour: string;
}) {
  return (
    <div className="mk-card mk-reveal" style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 40,
          height: 40,
          borderRadius: 11,
          background: `${colour}12`,
          color: colour,
          display: 'grid',
          placeItems: 'center',
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '-0.02em'
        }}
      >
        {String(index).padStart(2, '0')}
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="mk-eyebrow" style={{ color: colour, marginBottom: 6 }}>{kicker}</div>
        <h3 className="mk-h3" style={{ marginBottom: 7 }}>{title}</h3>
        <p className="mk-body">{body}</p>
      </div>
    </div>
  );
}

/* ─── A two-column split ──────────────────────────────────────────────── */

/**
 * "Kongila does this, you do that." Three of the four solution pages turn on
 * exactly that distinction, and a visitor reading one is deciding which side
 * of the line they want to stand on, so it gets its own block.
 */
export function ResponsibilitySplit({
  kongila,
  you,
  colour
}: {
  kongila: string;
  you: string;
  colour: string;
}) {
  return (
    <div className="mk-grid mk-grid--2 mk-reveal">
      <div className="mk-card" style={{ background: `${colour}08`, borderColor: `${colour}2E` }}>
        <div className="mk-eyebrow" style={{ color: colour, marginBottom: 10 }}>Kongila handles</div>
        <p className="mk-body" style={{ color: '#33415C' }}>{kongila}</p>
      </div>
      <div className="mk-card">
        <div className="mk-eyebrow" style={{ color: '#6B7A99', marginBottom: 10 }}>You keep</div>
        <p className="mk-body">{you}</p>
      </div>
    </div>
  );
}

/* ─── Kon, guiding ────────────────────────────────────────────────────── */

/**
 * A note from the mascot. Used sparingly — once a page at most — to say the
 * thing a visitor is actually wondering at that point. A mascot that
 * comments on everything stops being read.
 */
export function KonNote({
  state = 'pointing',
  children,
  direction = 'right'
}: {
  state?: MascotState;
  children: React.ReactNode;
  direction?: 'right' | 'left';
}) {
  return (
    <div
      className="mk-reveal"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 18px 14px 14px',
        borderRadius: 14,
        background: '#F4F8FF',
        border: '1px solid #D7E4FB',
        maxWidth: 560
      }}
    >
      <Mascot state={state} direction={direction} size={46} label="" />
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: '#33415C' }}>{children}</p>
    </div>
  );
}

/* ─── Closing call to action ──────────────────────────────────────────── */

export function ClosingCta({
  title,
  body,
  primary,
  secondary
}: {
  title: string;
  body?: string;
  primary?: HeroAction;
  secondary?: HeroAction;
}) {
  const p = primary || { href: startRequestHref(), label: 'Get Started' };
  const s = secondary || { href: JOIN_TALENT_HREF, label: 'Join as Talent' };

  return (
    <section style={{ padding: 'clamp(16px, 3vw, 32px) 0 clamp(64px, 8vw, 104px)' }}>
      <div className="mk-wrap">
        <div
          className="mk-reveal mk-closing"
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 28,
            padding: 'clamp(36px, 5vw, 64px)',
            background: 'linear-gradient(118deg, #00237A 0%, #0039A6 42%, #0A55D6 100%)',
            color: '#fff'
          }}
        >
          {/* Depth, drawn rather than imported: two soft lights and a grid
              that fades out. The flat blue slab this replaces was the
              weakest thing on every page — the last thing a visitor saw
              before the footer, and the least considered. */}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px),' +
                'linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)',
              backgroundSize: '56px 56px',
              maskImage: 'radial-gradient(130% 110% at 82% 10%, #000 10%, transparent 72%)',
              WebkitMaskImage: 'radial-gradient(130% 110% at 82% 10%, #000 10%, transparent 72%)',
              pointerEvents: 'none'
            }}
          />
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: '-38%',
              right: '-6%',
              width: 520,
              height: 520,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(61,127,255,0.55), transparent 62%)',
              pointerEvents: 'none'
            }}
          />
          <span
            aria-hidden
            style={{
              position: 'absolute',
              bottom: '-52%',
              left: '-4%',
              width: 440,
              height: 440,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(10,191,188,0.3), transparent 64%)',
              pointerEvents: 'none'
            }}
          />

          <div
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: 'clamp(28px, 4vw, 56px)',
              alignItems: 'center'
            }}
            className="mk-closing-grid"
          >
            <div style={{ maxWidth: 620 }}>
              <div
                className="mk-eyebrow"
                style={{ color: '#8FB7FF', marginBottom: 14 }}
              >
                Next step
              </div>
              <h2 className="mk-h2" style={{ color: '#fff', fontSize: 'clamp(1.75rem, 1.2rem + 2.1vw, 2.65rem)' }}>
                {title}
              </h2>
              {body && (
                <p style={{ margin: '16px 0 0', fontSize: 16, lineHeight: 1.62, color: '#BFD6FF', maxWidth: 520 }}>
                  {body}
                </p>
              )}

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 32 }}>
                <Link
                  href={p.href}
                  className="mk-btn"
                  style={{
                    background: '#fff',
                    color: '#00237A',
                    padding: '15px 26px',
                    fontSize: 15,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.18)'
                  }}
                >
                  {p.label}
                </Link>
                <Link
                  href={s.href}
                  className="mk-btn"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    borderColor: 'rgba(255,255,255,0.32)',
                    padding: '15px 26px',
                    fontSize: 15,
                    backdropFilter: 'blur(6px)'
                  }}
                >
                  {s.label}
                </Link>
              </div>
            </div>

            {/* Kon signing off. The only place the mascot appears at size on
                a marketing page, which is what keeps it from wearing thin. */}
            <div className="mk-closing-mascot" style={{ display: 'grid', placeItems: 'center' }}>
              <div
                style={{
                  width: 176,
                  height: 176,
                  borderRadius: 40,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(255,255,255,0.09)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <Mascot state="happy" tone="brand" size={116} label="" />
              </div>
            </div>
          </div>

          <style jsx>{`
            @media (max-width: 860px) {
              :global(.mk-closing-grid) { grid-template-columns: minmax(0, 1fr) !important; }
              :global(.mk-closing-mascot) { display: none !important; }
            }
          `}</style>
        </div>
      </div>
    </section>
  );
}

/* ─── Prose, for the long pages ───────────────────────────────────────── */

export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ maxWidth: 740, fontSize: 15, lineHeight: 1.72, color: '#33415C' }}
      className="mk-prose"
    >
      {children}
      <style jsx>{`
        .mk-prose :global(h2) {
          font-size: 19px;
          font-weight: 600;
          letter-spacing: -0.015em;
          color: #0E1726;
          margin: 38px 0 12px;
        }
        .mk-prose :global(h3) {
          font-size: 15.5px;
          font-weight: 600;
          color: #0E1726;
          margin: 26px 0 8px;
        }
        .mk-prose :global(p) { margin: 0 0 14px; }
        .mk-prose :global(ul) { margin: 0 0 16px; padding-left: 20px; }
        .mk-prose :global(li) { margin-bottom: 7px; }
        .mk-prose :global(table) {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0 22px;
          font-size: 13.5px;
        }
        .mk-prose :global(th),
        .mk-prose :global(td) {
          border: 1px solid var(--mk-rule);
          padding: 10px 12px;
          text-align: left;
          vertical-align: top;
        }
        .mk-prose :global(th) { background: #F6F8FC; font-weight: 600; color: #0E1726; }
      `}</style>
    </div>
  );
}
