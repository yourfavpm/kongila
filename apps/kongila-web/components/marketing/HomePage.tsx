/**
 * The homepage.
 *
 * Structure follows the approved website copy: the four ways to engage, then
 * the short path, then the two audiences side by side, each with its own way
 * in. The copy is that document's, close to verbatim, because it has been
 * signed off and rewriting it here would quietly put unapproved claims on
 * the front page.
 *
 * Two things the reference design has that are deliberately absent.
 *
 * There are no customer logos. The ones in the sample are placeholders for
 * other companies, and a logo wall implies those businesses are clients.
 *
 * There are no metrics. "500+ deployed", "99.8% SLA", "$12M+ payroll" are
 * plausible and entirely invented, and a number on a homepage is a claim a
 * buyer will hold the business to. Both blocks are ready to drop in the
 * moment there are real figures and real permission — see the trust strip
 * below, which carries the qualitative version in the meantime.
 */

import React from 'react';
import Link from 'next/link';
import Mascot from '../brand/Mascot';
import { useReveal } from './SiteChrome';
import {
  Section,
  SectionHead,
  Hero,
  IndicatorCard,
  CapabilityCard,
  NumberedStep,
  ClosingCta,
  KonNote
} from './blocks';
import { SOLUTIONS, PLATFORM_PAGES, startRequestHref, JOIN_TALENT_HREF } from './siteMap';

/** The short version of the process. The full six are on How It Works. */
const SHORT_STEPS = [
  {
    kicker: 'Define',
    title: 'Submit requirements',
    body: 'The roles, the skills, where the work happens and when you need people.',
    colour: '#0047CC'
  },
  {
    kicker: 'Match',
    title: 'Get matched',
    body: 'Candidates checked against what the role actually needs, not the job title.',
    colour: '#3D7FFF'
  },
  {
    kicker: 'Approve',
    title: 'Interview and approve',
    body: 'Meet the shortlist. You decide who moves ahead.',
    colour: '#0ABFBC'
  },
  {
    kicker: 'Deploy',
    title: 'Deploy and scale',
    body: 'Contracts, onboarding and payroll handled before the first day.',
    colour: '#1FB97A'
  }
];

/**
 * Answers, not marketing.
 *
 * Each one is either a fact about how the product works or an honest "not
 * yet". Nothing here invents a turnaround time, a country list or a price,
 * because those are the first things a buyer will hold the business to.
 */
const QUESTIONS = [
  {
    q: 'Do I need an account before I can hire?',
    a: 'No. Tell us what you need first — your account is created as part of that request, and you can track it from there.'
  },
  {
    q: 'Who employs the person?',
    a: 'That is the real difference between the four models. On Direct Hire they join your payroll. On the other three Kongila carries the employment, and what changes is who directs the work.'
  },
  {
    q: 'How are professionals checked?',
    a: 'Every profile goes through a seven-stage vetting process before anyone is put in front of a client, covering skills, experience, references and remote readiness.'
  },
  {
    q: 'What does it cost?',
    a: 'Pricing depends on the model, the roles and the markets involved, so there is no list price to quote. Start a request and we will come back with the numbers for your situation.'
  }
];

export default function HomePage() {
  // The homepage renders inside the portal page rather than the marketing
  // shell, so it arms its own scroll reveals.
  useReveal();

  return (
    <>
      <Hero
        eyebrow="Global workforce infrastructure"
        title={
          <>
            One workforce.
            <br />
            Four ways to build it.
          </>
        }
        lede="Hiring across borders usually means learning new employment rules, payroll systems and compliance requirements in every country you enter. Kongila brings that under one roof, so you can build a team without setting up the operation behind it yourself."
        actions={[
          { href: startRequestHref(), label: 'Get Started', kind: 'primary' },
          { href: JOIN_TALENT_HREF, label: 'Join the Talent Network', kind: 'ghost' }
        ]}
        aside={<HeroPanel />}
      />

      {/* Qualitative trust, until there are figures that can be stood behind. */}
      <div style={{ borderTop: '1px solid var(--mk-rule)', borderBottom: '1px solid var(--mk-rule)' }}>
        <div
          className="mk-wrap"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '18px 40px',
            padding: '20px 24px',
            alignItems: 'center'
          }}
        >
          {[
            ['#0047CC', 'Vetted talent', 'Seven stages before anyone is put forward'],
            ['#0ABFBC', 'Compliant by default', 'Contracts and local requirements handled'],
            ['#6E5BE8', 'One operational layer', 'Hiring, payroll and operations in one place']
          ].map(([colour, title, detail]) => (
            <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ width: 7, height: 7, borderRadius: 4, background: colour, flexShrink: 0 }} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: '#0E1726' }}>{title}</span>
              <span style={{ fontSize: 13, color: '#6B7A99' }}>{detail}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Four ways to engage ───────────────────────────────────────── */}
      <Section>
        <SectionHead
          eyebrow="Solutions"
          title="Four ways to work with Kongila"
          lede="Not every business needs the same kind of support. Choose the model that fits — all four draw from the same talent network."
        />
        <div className="mk-grid mk-grid--4 mk-reveal">
          {SOLUTIONS.map(s => (
            <IndicatorCard
              key={s.slug}
              colour={s.colour}
              title={s.name}
              body={s.summary}
              href={`/solutions/${s.slug}`}
              cta="Learn more"
            />
          ))}
        </div>
        <div style={{ marginTop: 28 }}>
          <KonNote>
            Not sure which fits? Start a request and tell us what you need — we will point you at the
            right one before anything is committed.
          </KonNote>
        </div>
      </Section>

      {/* ── What Kongila actually runs ────────────────────────────────── */}
      <Section tint>
        <SectionHead
          eyebrow="The platform"
          title="Everything your global workforce needs"
          lede="Six things that are usually six vendors, six contracts and six places to look. They run as one layer here."
        />
        <div className="mk-grid mk-grid--3 mk-reveal">
          {PLATFORM_PAGES.map(p => (
            <CapabilityCard key={p.slug} title={p.name} body={p.summary} colour={p.colour} />
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <Link href="/enterprise" className="mk-btn mk-btn--ghost">See how it fits together</Link>
        </div>
      </Section>

      {/* ── The short path ────────────────────────────────────────────── */}
      <Section>
        <SectionHead
          eyebrow="How it works"
          title="From workforce need to working team"
          lede="Four stages from telling us what you need to a team doing the work. You can see where a request has got to at any point, without asking anyone."
        />
        <div className="mk-grid mk-grid--4">
          {SHORT_STEPS.map((step, i) => (
            <NumberedStep
              key={step.kicker}
              index={i + 1}
              kicker={step.kicker}
              title={step.title}
              body={step.body}
              colour={step.colour}
            />
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <Link href="/how-it-works" className="mk-btn mk-btn--ghost">See all six stages</Link>
        </div>
      </Section>

      {/* ── The two audiences ─────────────────────────────────────────── */}
      <Section>
        <div className="mk-grid mk-grid--2 mk-reveal">
          <AudienceCard
            colour="#0047CC"
            eyebrow="For employers"
            title="Tell us what you need"
            body="We handle the hiring, compliance and payroll behind it. You decide who joins and what they work on."
            points={[
              'Define the role, the skills and where the work happens',
              'Review a shortlist that has already been screened',
              'Contracts, onboarding and payroll handled before day one'
            ]}
            cta={{ href: startRequestHref(), label: 'Hire Talent' }}
          />
          <AudienceCard
            colour="#0ABFBC"
            eyebrow="For professionals"
            title="Build a profile once"
            body="Get matched to roles that fit your skills, wherever they are based. Your profile is checked and verified, not just self-reported."
            points={[
              'Set up a profile and complete verification',
              'Get matched on what you can do, not what is listed nearby',
              'Work with organisations outside your local market'
            ]}
            cta={{ href: JOIN_TALENT_HREF, label: 'Join the Talent Network' }}
          />
        </div>
      </Section>

      {/* ── The questions people actually ask ─────────────────────────── */}
      <Section tint>
        <SectionHead
          title="Questions worth answering first"
          lede="The four things most people want settled before they get in touch."
        />
        <div className="mk-grid mk-grid--2 mk-reveal" style={{ maxWidth: 1000, margin: '0 auto' }}>
          {QUESTIONS.map(q => (
            <div key={q.q} className="mk-card">
              <h3 className="mk-h3" style={{ fontSize: 15.5, marginBottom: 9 }}>{q.q}</h3>
              <p className="mk-body">{q.a}</p>
            </div>
          ))}
        </div>
      </Section>

      <ClosingCta
        title="Ready to build your global team?"
        body="Tell us what you need. We will help you put the workforce together to deliver it."
      />
    </>
  );
}

/**
 * The hero's supporting panel.
 *
 * The approved copy says no dashboard mockup on the homepage — that is saved
 * for Enterprise — and there is no photography yet, so this is neither. It
 * is the four models as a stack of cards, which is what Kon is and what the
 * product does, and it lets a visitor find their own situation before they
 * have read a word of body copy.
 */
function HeroPanel() {
  return (
    <div
      style={{
        position: 'relative',
        background: '#fff',
        border: '1px solid var(--mk-rule)',
        borderRadius: 22,
        padding: 22,
        boxShadow: '0 24px 60px rgba(14,23,38,0.07)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <Mascot state="matched" size={52} label="" />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0E1726' }}>Which one are you?</div>
          <div style={{ fontSize: 12.5, color: '#6B7A99' }}>Pick a model to see how it works</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {SOLUTIONS.map(s => (
          <Link
            key={s.slug}
            href={`/solutions/${s.slug}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 11,
              border: '1px solid var(--mk-rule)',
              textDecoration: 'none',
              background: '#FDFEFF',
              transition: 'border-color 150ms ease, background 150ms ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = `${s.colour}55`;
              e.currentTarget.style.background = `${s.colour}08`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--mk-rule)';
              e.currentTarget.style.background = '#FDFEFF';
            }}
          >
            <span style={{ width: 3, height: 26, borderRadius: 2, background: s.colour, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#0E1726' }}>{s.name}</span>
              <span style={{ display: 'block', fontSize: 12, color: '#6B7A99', marginTop: 1 }}>{s.summary}</span>
            </span>
            <span aria-hidden style={{ color: s.colour, fontSize: 14 }}>→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function AudienceCard({
  colour,
  eyebrow,
  title,
  body,
  points,
  cta
}: {
  colour: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  cta: { href: string; label: string };
}) {
  return (
    <div className="mk-card" style={{ padding: 30, display: 'flex', flexDirection: 'column' }}>
      <span className="mk-indicator" style={{ background: colour, display: 'block' }} />
      <div className="mk-eyebrow" style={{ color: colour, marginBottom: 10 }}>{eyebrow}</div>
      <h3 className="mk-h2" style={{ fontSize: 24, marginBottom: 12 }}>{title}</h3>
      <p className="mk-body" style={{ marginBottom: 20 }}>{body}</p>

      <ul style={{ listStyle: 'none', margin: '0 0 26px', padding: 0, display: 'grid', gap: 11 }}>
        {points.map(p => (
          <li key={p} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span
              aria-hidden
              style={{
                marginTop: 6,
                width: 5,
                height: 5,
                borderRadius: 3,
                background: colour,
                flexShrink: 0
              }}
            />
            <span style={{ fontSize: 13.5, lineHeight: 1.6, color: '#526180' }}>{p}</span>
          </li>
        ))}
      </ul>

      <Link
        href={cta.href}
        className="mk-btn mk-btn--primary"
        style={{ marginTop: 'auto', alignSelf: 'flex-start', background: colour }}
      >
        {cta.label}
      </Link>
    </div>
  );
}
