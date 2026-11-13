/**
 * About Kongila.
 *
 * The approved copy for this page is one paragraph, and everything a reader
 * would normally expect here — the founding story, the leadership, the
 * photographs — is marked in the content document as still to come from the
 * client. So the page says the one true thing well and does not pad.
 *
 * No invented history, no stock photograph of a team that is not this team,
 * no "founded in" year that nobody has confirmed. The two slots that are
 * waiting on real material say so.
 */

import React from 'react';
import MarketingPage from '../components/marketing/SiteChrome';
import { Hero, Section, SectionHead, CapabilityCard, ClosingCta } from '../components/marketing/blocks';
import { startRequestHref, JOIN_TALENT_HREF } from '../components/marketing/siteMap';

const WHAT_WE_DO = [
  {
    title: 'For businesses',
    body: 'Make it easier to build a workforce across markets, without setting up hiring, compliance and payroll in each one.',
    colour: '#0047CC'
  },
  {
    title: 'For professionals',
    body: 'Open up opportunities beyond a local job market, with a profile that has been verified rather than self-reported.',
    colour: '#0ABFBC'
  },
  {
    title: 'The work behind it',
    body: 'We handle the hiring, compliance and payroll that sits underneath both sides of that exchange.',
    colour: '#6E5BE8'
  }
];

export default function AboutPage() {
  return (
    <MarketingPage
      title="About"
      description="Kongila exists to make it easier for businesses to build a workforce across markets, and for professionals to find opportunities beyond their local job market."
    >
      <Hero
        eyebrow="About"
        title="Work should not be limited by where someone lives"
        lede="Kongila exists to make it easier for businesses to build a workforce across markets, and for professionals to find opportunities beyond their local job market. We handle the hiring, compliance and payroll work behind that."
        actions={[
          { href: startRequestHref(), label: 'Hire Talent', kind: 'primary' },
          { href: JOIN_TALENT_HREF, label: 'Join as Talent', kind: 'ghost' }
        ]}
      />

      <Section tint>
        <SectionHead title="What that means in practice" />
        <div className="mk-grid mk-grid--3 mk-reveal">
          {WHAT_WE_DO.map(c => (
            <CapabilityCard key={c.title} title={c.title} body={c.body} colour={c.colour} />
          ))}
        </div>
      </Section>

      <Section>
        <div className="mk-about-feature mk-reveal">
          <div className="mk-about-feature__copy">
            <div className="mk-eyebrow" style={{ marginBottom: 14 }}>A connected workforce</div>
            <h2 className="mk-h2">Opportunity should travel both ways.</h2>
            <p className="mk-lede" style={{ marginTop: 16 }}>
              Businesses need capable people across markets. Professionals deserve access to work beyond the places they live. Kongila brings the infrastructure for both sides together.
            </p>
          </div>
          <div className="mk-about-feature__graphic" aria-hidden="true">
            <svg viewBox="0 0 420 250" role="presentation">
              <path d="M55 178C107 67 290 45 365 112" fill="none" stroke="#8EB2F2" strokeWidth="2" strokeDasharray="5 8" />
              <circle cx="55" cy="178" r="7" fill="#0ABFBC"/><circle cx="365" cy="112" r="7" fill="#0047CC"/>
              <circle cx="205" cy="77" r="5" fill="#7CCFC5"/>
              <rect x="27" y="139" width="112" height="70" rx="14" fill="#fff"/>
              <circle cx="57" cy="174" r="15" fill="#D9F2ED"/><path d="M50 174h14M57 167v14" stroke="#087E78" strokeWidth="2" strokeLinecap="round"/>
              <rect x="82" y="166" width="42" height="5" rx="2.5" fill="#8292AD"/><rect x="82" y="178" width="31" height="4" rx="2" fill="#C5D0E0"/>
              <rect x="277" y="71" width="116" height="70" rx="14" fill="#fff"/>
              <circle cx="308" cy="106" r="15" fill="#E3ECFF"/><path d="M301 106h14M308 99v14" stroke="#0047CC" strokeWidth="2" strokeLinecap="round"/>
              <rect x="333" y="98" width="43" height="5" rx="2.5" fill="#8292AD"/><rect x="333" y="110" width="32" height="4" rx="2" fill="#C5D0E0"/>
              <rect x="143" y="154" width="138" height="60" rx="15" fill="#0B2B69"/><text x="212" y="180" textAnchor="middle" fill="#fff" fontSize="13" fontFamily="Inter, sans-serif" fontWeight="600">Kongila</text><text x="212" y="197" textAnchor="middle" fill="#C3D8FF" fontSize="10" fontFamily="Inter, sans-serif">workforce infrastructure</text>
            </svg>
            <span>People first. Operations built around them.</span>
          </div>
        </div>
      </Section>

      <ClosingCta
        title="Build your team with Kongila"
        body="Whichever side of the exchange you are on, start here."
      />
    </MarketingPage>
  );
}
