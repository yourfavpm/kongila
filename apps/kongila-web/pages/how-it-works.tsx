/**
 * How It Works.
 *
 * The approved copy calls this the most visual page on the site, and it
 * carries the six-stage process that the whole business runs on. Short
 * version first as a strip, then the six stages in detail, then the four
 * models recapped so the page ends by pointing somewhere.
 */

import React from 'react';
import Link from 'next/link';
import MarketingPage from '../components/marketing/SiteChrome';
import {
  Hero,
  Section,
  SectionHead,
  StageStrip,
  NumberedStep,
  IndicatorCard,
  ClosingCta
} from '../components/marketing/blocks';
import { SOLUTIONS, startRequestHref } from '../components/marketing/siteMap';

const SHORT_PATH = ['Submit requirements', 'Get matched', 'Interview and approve', 'Deploy and scale'];

/** The six stages, with a colour each so the page has a spine. */
const STEPS = [
  {
    kicker: 'Define',
    title: 'Tell us what you need',
    body: 'Give us the roles, the skills required, where the work needs to happen, your timeline and the engagement model you want. We take it from there.',
    colour: '#0047CC'
  },
  {
    kicker: 'Match',
    title: 'We find the right professionals',
    body: "We look at what the role needs and match it against each candidate's skills, experience, availability and readiness to work remotely.",
    colour: '#1B5EE0'
  },
  {
    kicker: 'Approve',
    title: 'Meet your shortlist',
    body: "Review the candidates we've put forward, check they're the right fit, and choose who you want to move ahead with.",
    colour: '#3D7FFF'
  },
  {
    kicker: 'Deploy',
    title: 'We handle the operational setup',
    body: 'Contracts, onboarding, compliance and payroll get sorted through Kongila before the team starts.',
    colour: '#0ABFBC'
  },
  {
    kicker: 'Operate',
    title: 'Your team gets to work',
    body: "Kongila keeps the operational side running while you focus on the work itself and the results you're after.",
    colour: '#1FB97A'
  },
  {
    kicker: 'Scale',
    title: 'Grow when your business needs more',
    body: 'Add people, move into new markets, or increase capacity, without having to rebuild how you work from the ground up.',
    colour: '#6E5BE8'
  }
];

export default function HowItWorks() {
  return (
    <MarketingPage
      title="How It Works"
      description="From workforce need to working team: define, match, approve, deploy, operate and scale."
    >
      <Hero
        eyebrow="How it works"
        title="From workforce need to working team"
        lede="Building a workforce across borders usually gets complicated fast. Kongila keeps it simple, from the moment you tell us what you need through to running the team day to day."
        actions={[{ href: startRequestHref(), label: 'Get Started' }]}
        footnote={<StageStrip stages={SHORT_PATH} />}
      />

      <Section tint>
        <SectionHead
          title="The six stages in full"
          lede="Each stage has an owner, a next step and a place it shows up in your portal."
        />
        <div className="mk-grid mk-grid--2">
          {STEPS.map((s, i) => (
            <NumberedStep
              key={s.kicker}
              index={i + 1}
              kicker={s.kicker}
              title={s.title}
              body={s.body}
              colour={s.colour}
            />
          ))}
        </div>
      </Section>

      <Section>
        <SectionHead
          eyebrow="Solutions"
          title="One workforce, four ways to engage"
          lede="The six stages run the same way whichever model you pick. What changes is who employs the person and who directs the work."
        />
        <div className="mk-grid mk-grid--4 mk-reveal">
          {SOLUTIONS.map(s => (
            <IndicatorCard
              key={s.slug}
              colour={s.colour}
              title={s.name}
              body={s.summary}
              href={`/solutions/${s.slug}`}
              cta="Talk to an expert"
            />
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 26 }}>
          <Link href="/solutions" className="mk-btn mk-btn--ghost">Compare all four</Link>
        </div>
      </Section>

      <ClosingCta
        title="Ready to build your global team?"
        body="Tell us what you need. We'll help you put the workforce together to deliver it."
      />
    </MarketingPage>
  );
}
