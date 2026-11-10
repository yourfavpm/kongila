/**
 * The talent side of the site.
 *
 * Different audience, different job. An employer is evaluating a supplier;
 * a professional is deciding whether to spend an hour on a profile for a
 * company they have not heard of. So this page answers what they get and
 * what is expected of them, in that order, and the vetting is stated plainly
 * rather than hidden — being checked is the thing that makes the profile
 * worth something to an employer, and saying so up front filters for the
 * people who will finish it.
 */

import React from 'react';
import Link from 'next/link';
import MarketingPage from '../components/marketing/SiteChrome';
import Mascot from '../components/brand/Mascot';
import {
  Hero,
  Section,
  SectionHead,
  StageStrip,
  CapabilityCard,
  ClosingCta,
  KonNote
} from '../components/marketing/blocks';
import { JOIN_TALENT_HREF } from '../components/marketing/siteMap';

const JOURNEY = ['Create account', 'Complete profile', 'Get verified', 'Get matched'];

const WHAT_YOU_GET = [
  {
    title: 'Professional Profile',
    body: "Your skills and experience in front of employers through a profile that has been checked and verified, not just self-reported.",
    colour: '#0047CC'
  },
  {
    title: 'Global Opportunities',
    body: 'Roles matched on what you can actually do and where your career is heading, not just what is listed nearby.',
    colour: '#0ABFBC'
  },
  {
    title: 'Contracts and payment handled',
    body: 'Kongila carries the employment side, so getting paid across borders is not something you have to negotiate yourself.',
    colour: '#1FB97A'
  },
  {
    title: 'A profile that keeps its value',
    body: 'Verification stays with you. You are not starting from scratch for every new opportunity.',
    colour: '#6E5BE8'
  }
];

export default function TalentPage() {
  return (
    <MarketingPage
      title="For Professionals"
      description="Build a profile once. Get matched to opportunities with organisations around the world, based on your skills and experience."
    >
      <Hero
        eyebrow="For professionals"
        title="Build a profile once. Get matched on what you can do."
        lede="Get matched to opportunities with organisations around the world, based on your skills and experience rather than where you happen to live."
        actions={[
          { href: JOIN_TALENT_HREF, label: 'Join the Talent Network', kind: 'primary' },
          { href: '#how', label: 'See how it works', kind: 'ghost' }
        ]}
        aside={<ProfileIllustration />}
      />

      <Section id="how" tint>
        <SectionHead
          title="From sign up to your first role"
          lede="Four steps. The middle one is the one that matters, and it is the one most people stop halfway through."
        />
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <StageStrip stages={JOURNEY} colour="#0ABFBC" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
          <KonNote state="thinking">
            Verification takes a little work — references, a skills assessment, sometimes a short task.
            It is also the reason an employer takes your profile seriously, so it is worth finishing.
          </KonNote>
        </div>
      </Section>

      <Section>
        <SectionHead title="What you get" lede="Four things a Kongila profile gives you that a job board does not." />
        <div className="mk-grid mk-grid--4 mk-reveal">
          {WHAT_YOU_GET.map(c => (
            <CapabilityCard key={c.title} title={c.title} body={c.body} colour={c.colour} />
          ))}
        </div>
      </Section>

      {/* Career Resources is in the approved copy but has no articles behind
          it yet, so it is an honest "coming" rather than a page of invented
          advice with a Kongila byline on it. */}
      <Section tint>
        <div
          className="mk-card mk-reveal"
          style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', padding: 28 }}
        >
          <Mascot state="empty" size={64} label="" />
          <div style={{ flex: 1, minWidth: 260 }}>
            <h3 className="mk-h3" style={{ marginBottom: 6 }}>Career resources</h3>
            <p className="mk-body">
              Guidance on presenting yourself well and working across markets is being written now.
              Join the network and it will reach you when it is ready.
            </p>
          </div>
          <Link href={JOIN_TALENT_HREF} className="mk-btn mk-btn--ghost">Join the network</Link>
        </div>
      </Section>

      <ClosingCta
        title="Put your profile in front of employers"
        body="Set up your profile and open the door to roles with employers outside your local market."
        primary={{ href: JOIN_TALENT_HREF, label: 'Join the Talent Network' }}
        secondary={{ href: '/login', label: 'Already have an account?' }}
      />
    </MarketingPage>
  );
}

/**
 * An illustrative profile, not a screenshot.
 *
 * The approved copy asks for a layout suggesting Experience, Skills and
 * Verification without showing the real interface, and nothing here claims
 * to be a real candidate: no name, no photograph, no score.
 */
function ProfileIllustration() {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--mk-rule)',
        borderRadius: 22,
        padding: 24,
        boxShadow: '0 24px 60px rgba(14,23,38,0.07)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <Mascot state="happy" size={54} label="" />
        <div style={{ flex: 1 }}>
          <div style={{ height: 9, width: '55%', borderRadius: 5, background: '#E4E9F2', marginBottom: 7 }} />
          <div style={{ height: 7, width: '36%', borderRadius: 4, background: '#EEF2F8' }} />
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#128A5B',
            background: '#D4F5E6',
            padding: '5px 10px',
            borderRadius: 999
          }}
        >
          Verified
        </span>
      </div>

      {[
        ['Experience', ['#DCE9FF', '#EEF2F8', '#EEF2F8']],
        ['Skills', ['#D4F5E6', '#DCE9FF', '#EEF2F8']],
        ['Verification', ['#D4F5E6', '#D4F5E6', '#EEF2F8']]
      ].map(([label, bars]) => (
        <div key={label as string} style={{ marginBottom: 16 }}>
          <div className="mk-eyebrow" style={{ color: '#9AA8C2', marginBottom: 8 }}>{label as string}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(bars as string[]).map((bg, i) => (
              <span key={i} style={{ flex: 1, height: 10, borderRadius: 5, background: bg }} />
            ))}
          </div>
        </div>
      ))}

      <div
        style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: '1px solid var(--mk-rule)',
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}
      >
        <Mascot state="matched" size={34} label="" />
        <span style={{ fontSize: 12.5, color: '#6B7A99' }}>Matched to roles as they open</span>
      </div>
    </div>
  );
}
