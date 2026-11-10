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
import Mascot from '../components/brand/Mascot';
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

      {/* The honest gap. Better an empty shelf than a fabricated one. */}
      <Section>
        <div
          className="mk-card mk-reveal"
          style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', padding: 30 }}
        >
          <Mascot state="thinking" size={62} label="" />
          <div style={{ flex: 1, minWidth: 280 }}>
            <h3 className="mk-h3" style={{ marginBottom: 7 }}>More about us, shortly</h3>
            <p className="mk-body">
              Our story, the people behind Kongila and photographs of the team are being put together.
              We would rather leave this space empty than fill it with something that is not ours.
            </p>
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
