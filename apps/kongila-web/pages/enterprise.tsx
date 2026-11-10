/**
 * Enterprise.
 *
 * The approved copy is explicit here: no photography, straight into the
 * diagram, and let the diagram carry the message with the surrounding copy
 * kept minimal. The diagram is the argument — three concerns that are
 * usually three separate vendors, merging into one operational layer before
 * they reach the business. Drawn rather than described, because a buyer
 * evaluating this is drawing it on a whiteboard anyway.
 */

import React from 'react';
import MarketingPage from '../components/marketing/SiteChrome';
import { Hero, Section, SectionHead, CapabilityCard, ClosingCta } from '../components/marketing/blocks';
import { startRequestHref } from '../components/marketing/siteMap';

const CAPABILITIES = [
  { title: 'Global Talent Acquisition', body: 'Reach professionals in new markets without building a sourcing team there first.', colour: '#0047CC' },
  { title: 'Compliance Infrastructure', body: 'Keep employment contracts and local requirements in order across every country you operate in.', colour: '#1B5EE0' },
  { title: 'Global Payroll', body: 'Pay your workforce accurately, wherever they are, through one consolidated process.', colour: '#3D7FFF' },
  { title: 'Workforce Operations', body: 'Handle onboarding, performance tracking and the day-to-day running of the team.', colour: '#0ABFBC' },
  { title: 'Workforce Scaling', body: 'Add or reduce workforce capacity as your business changes, without starting over.', colour: '#1FB97A' },
  { title: 'Operational Visibility', body: 'See how your workforce is performing without chasing updates market by market.', colour: '#6E5BE8' }
];

const BUILT_FOR = [
  'Multi-country teams',
  'Multiple roles and departments',
  'Complex workforce requirements',
  'Compliance considerations',
  'Consolidated administration',
  'Performance visibility'
];

export default function EnterprisePage() {
  return (
    <MarketingPage
      title="Enterprise"
      description="Global workforce infrastructure for modern enterprises. Talent, compliance and payroll running through one operational layer."
    >
      <Hero
        eyebrow="Enterprise"
        title="Global workforce infrastructure for modern enterprises"
        lede="Entering a new market usually means setting up hiring, compliance and payroll from scratch, in every country you operate in. Kongila runs that infrastructure for you, so your team can build and manage a distributed workforce without carrying the operational load themselves."
        actions={[
          { href: startRequestHref(), label: 'Talk to Kongila', kind: 'primary' },
          { href: '/how-it-works', label: 'How it works', kind: 'ghost' }
        ]}
      />

      <Section tint>
        <SectionHead
          title="Your global workforce, one operational layer"
          lede="Three concerns that are usually three vendors, three contracts and three sets of reporting. They merge before they reach you."
        />
        <div className="mk-reveal" style={{ display: 'flex', justifyContent: 'center' }}>
          <OperationalLayerDiagram />
        </div>
      </Section>

      <Section>
        <SectionHead title="Enterprise capabilities" />
        <div className="mk-grid mk-grid--3 mk-reveal">
          {CAPABILITIES.map(c => (
            <CapabilityCard key={c.title} title={c.title} body={c.body} colour={c.colour} />
          ))}
        </div>
      </Section>

      <Section tint>
        <div
          className="mk-reveal"
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 40, alignItems: 'start' }}
        >
          <div>
            <h2 className="mk-h2">Built for the complexity of global operations</h2>
            <p className="mk-lede" style={{ marginTop: 14 }}>
              Kongila is built to handle the situations that break a single-country process.
            </p>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
            {BUILT_FOR.map(item => (
              <li
                key={item}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  padding: '13px 16px',
                  background: '#fff',
                  border: '1px solid var(--mk-rule)',
                  borderRadius: 10,
                  fontSize: 14,
                  color: '#33415C'
                }}
              >
                <span aria-hidden style={{ width: 6, height: 6, borderRadius: 3, background: '#0047CC' }} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <ClosingCta
        title="Let's build your global workforce"
        body="Tell us which markets you are entering and what the team needs to look like."
        primary={{ href: startRequestHref(), label: 'Talk to Kongila' }}
        secondary={{ href: '/solutions', label: 'See the four models' }}
      />
    </MarketingPage>
  );
}

/**
 * Three lines merging into one.
 *
 * Deliberately a branching diagram rather than a vertical stack: the whole
 * claim is that separate concerns converge before they reach the business,
 * and a straight line down would say the opposite.
 */
function OperationalLayerDiagram() {
  const pillars = [
    { x: 90, label: 'Talent', colour: '#0047CC' },
    { x: 330, label: 'Compliance', colour: '#0ABFBC' },
    { x: 570, label: 'Payroll', colour: '#6E5BE8' }
  ];

  return (
    <svg
      viewBox="0 0 720 420"
      style={{ width: '100%', maxWidth: 720, height: 'auto' }}
      role="img"
      aria-label="Talent, compliance and payroll run through Kongila into a single workforce operations layer, then into your business."
    >
      {/* Kongila at the top */}
      <rect x="282" y="12" width="156" height="46" rx="12" fill="#0047CC" />
      <text x="360" y="41" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="600" fontFamily="Inter, sans-serif">
        Kongila
      </text>

      {/* Down, then out to the three pillars */}
      <path d="M360 58 L360 92" stroke="#C3CEE2" strokeWidth="2" fill="none" />
      <path d="M160 92 L560 92" stroke="#C3CEE2" strokeWidth="2" fill="none" />
      {pillars.map(p => (
        <path key={`in-${p.label}`} d={`M${p.x + 70} 92 L${p.x + 70} 128`} stroke="#C3CEE2" strokeWidth="2" fill="none" />
      ))}

      {pillars.map(p => (
        <g key={p.label}>
          <rect x={p.x} y="128" width="140" height="58" rx="12" fill="#fff" stroke={p.colour} strokeWidth="1.5" />
          <rect x={p.x + 16} y="150" width="4" height="16" rx="2" fill={p.colour} />
          <text
            x={p.x + 30}
            y="162"
            fill="#0E1726"
            fontSize="14"
            fontWeight="600"
            fontFamily="Inter, sans-serif"
            dominantBaseline="middle"
          >
            {p.label}
          </text>
        </g>
      ))}

      {/* Back in, merging */}
      {pillars.map(p => (
        <path key={`out-${p.label}`} d={`M${p.x + 70} 186 L${p.x + 70} 222`} stroke="#C3CEE2" strokeWidth="2" fill="none" />
      ))}
      <path d="M160 222 L560 222" stroke="#C3CEE2" strokeWidth="2" fill="none" />
      <path d="M360 222 L360 258" stroke="#C3CEE2" strokeWidth="2" fill="none" />

      <rect x="230" y="258" width="260" height="54" rx="12" fill="#EAF1FF" stroke="#B9D0F7" strokeWidth="1.5" />
      <text x="360" y="289" textAnchor="middle" fill="#0039A6" fontSize="14.5" fontWeight="600" fontFamily="Inter, sans-serif">
        Workforce Operations
      </text>

      <path d="M360 312 L360 348" stroke="#C3CEE2" strokeWidth="2" fill="none" />
      <path d="M354 340 L360 348 L366 340" stroke="#C3CEE2" strokeWidth="2" fill="none" strokeLinecap="round" />

      <rect x="258" y="348" width="204" height="52" rx="12" fill="#0E1726" />
      <text x="360" y="378" textAnchor="middle" fill="#fff" fontSize="14.5" fontWeight="600" fontFamily="Inter, sans-serif">
        Your business
      </text>
    </svg>
  );
}
