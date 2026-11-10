/**
 * Solutions overview.
 *
 * The one page whose whole job is helping somebody place themselves. Four
 * cards, one line each, and a comparison underneath for the visitor who is
 * between two of them — which is most of them, since the real question is
 * usually "who employs the person" and that is not obvious from the names.
 */

import React from 'react';
import Link from 'next/link';
import MarketingPage from '../../components/marketing/SiteChrome';
import { Hero, Section, SectionHead, IndicatorCard, ClosingCta } from '../../components/marketing/blocks';
import { SOLUTIONS, startRequestHref } from '../../components/marketing/siteMap';

/** The question behind the choice, answered per model. */
const COMPARISON: { label: string; values: Record<string, string> }[] = [
  {
    label: 'Who employs the person',
    values: {
      'direct-hire': 'You do',
      'talent-outsourcing': 'Kongila',
      'project-management': 'Kongila',
      'managed-service': 'Kongila'
    }
  },
  {
    label: 'Who directs the work',
    values: {
      'direct-hire': 'You do',
      'talent-outsourcing': 'You do',
      'project-management': 'Kongila',
      'managed-service': 'Kongila'
    }
  },
  {
    label: 'What you receive',
    values: {
      'direct-hire': 'A hire',
      'talent-outsourcing': 'A team',
      'project-management': 'A delivered project',
      'managed-service': 'An outcome'
    }
  },
  {
    label: 'Best when',
    values: {
      'direct-hire': 'The role is permanent and yours',
      'talent-outsourcing': 'You want the people, not the paperwork',
      'project-management': 'The work has a defined end',
      'managed-service': 'You want the function off your plate'
    }
  }
];

export default function SolutionsIndex() {
  return (
    <MarketingPage
      title="Solutions"
      description="Four ways to engage with Kongila: direct hire, talent outsourcing, project management and managed service. All drawing from the same talent network."
    >
      <Hero
        eyebrow="Solutions"
        title="One workforce, four ways to engage"
        lede="Every business needs people differently. Kongila offers four ways to engage, all drawing from the same talent network."
        actions={[{ href: startRequestHref(), label: 'Get Started' }]}
      />

      <Section>
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
      </Section>

      <Section tint>
        <SectionHead
          title="Which one is yours?"
          lede="The difference between the four comes down to who employs the person and who directs the work."
        />
        <div className="mk-reveal" style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              minWidth: 720,
              borderCollapse: 'separate',
              borderSpacing: 0,
              background: '#fff',
              border: '1px solid var(--mk-rule)',
              borderRadius: 14,
              overflow: 'hidden',
              fontSize: 13.5
            }}
          >
            <thead>
              <tr>
                <th style={{ ...cell, background: '#F6F8FC', textAlign: 'left', width: 180 }} />
                {SOLUTIONS.map(s => (
                  <th key={s.slug} style={{ ...cell, background: '#F6F8FC', textAlign: 'left' }}>
                    <span className="mk-indicator" style={{ background: s.colour, display: 'block', marginBottom: 8 }} />
                    <Link
                      href={`/solutions/${s.slug}`}
                      style={{ fontSize: 13.5, fontWeight: 600, color: '#0E1726', textDecoration: 'none' }}
                    >
                      {s.name}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map(row => (
                <tr key={row.label}>
                  <th style={{ ...cell, textAlign: 'left', fontWeight: 600, color: '#33415C', background: '#FCFDFE' }}>
                    {row.label}
                  </th>
                  {SOLUTIONS.map(s => (
                    <td key={s.slug} style={{ ...cell, color: '#526180' }}>
                      {row.values[s.slug]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <ClosingCta
        title="Not sure which model fits?"
        body="Start a request and describe the work. We will tell you which engagement makes sense before anything is committed."
        primary={{ href: startRequestHref(), label: 'Start a request' }}
        secondary={{ href: '/how-it-works', label: 'See how it works' }}
      />
    </MarketingPage>
  );
}

const cell: React.CSSProperties = {
  padding: '13px 16px',
  borderBottom: '1px solid var(--mk-rule)',
  verticalAlign: 'top'
};
