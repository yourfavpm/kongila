import React, { useState } from 'react';
import Link from 'next/link';
import { useReveal } from './SiteChrome';
import { ClosingCta } from './blocks';
import {
  PLATFORM_PAGES,
  SOLUTIONS,
  JOIN_TALENT_HREF,
  startRequestHref
} from './siteMap';

const JOURNEY = [
  { label: 'Define', title: 'Set the brief', body: 'The roles, skills, location and engagement model your team needs.', accent: '#7DA7FF' },
  { label: 'Match', title: 'Find the fit', body: 'Candidates checked against what the role actually needs.', accent: '#67D4C8' },
  { label: 'Approve', title: 'Meet your shortlist', body: 'Review the candidates and choose who moves ahead.', accent: '#F1C77A' },
  { label: 'Deploy', title: 'Start with confidence', body: 'Contracts, onboarding and payroll handled before day one.', accent: '#9D8BF3' }
];

const QUESTIONS = [
  { q: 'Do I need an account before I can hire?', a: 'No. Tell us what you need first — your account is created as part of that request, and you can track it from there.' },
  { q: 'Who employs the person?', a: 'That is the real difference between the four models. On Direct Hire they join your payroll. On the other three Kongila carries the employment, and what changes is who directs the work.' },
  { q: 'How are professionals checked?', a: 'Every profile goes through a seven-stage vetting process before anyone is put in front of a client, covering skills, experience, references and remote readiness.' },
  { q: 'What does it cost?', a: 'Pricing depends on the model, the roles and the markets involved, so there is no list price to quote. Start a request and we will come back with the numbers for your situation.' }
];

export default function HomePage() {
  useReveal();

  return (
    <div className="mk-home">
      <HomeHero />
      <TrustBand />
      <SolutionExplorer />
      <PlatformShowcase />
      <WorkforceJourney />
      <AudienceSplit />
      <Questions />
      <ClosingCta
        title="Ready to build your global team?"
        body="Tell us what you need. We will help you put the workforce together to deliver it."
      />
    </div>
  );
}

function HomeHero() {
  return (
    <section className="mk-home-hero">
      <div className="mk-home-hero__grid" aria-hidden="true" />
      <div className="mk-wrap mk-home-hero__layout">
        <div className="mk-home-hero__copy mk-reveal is-in">
          <p className="mk-home-kicker"><span /> Global workforce infrastructure</p>
          <h1>One workforce.<br /><em>Four ways</em> to build it.</h1>
          <p className="mk-home-hero__lede">
            Hiring across borders usually means learning new employment rules, payroll systems and compliance requirements in every country you enter. Kongila brings that under one roof, so you can build a team without setting up the operation behind it yourself.
          </p>
          <div className="mk-home-hero__actions">
            <Link href={startRequestHref()} className="mk-home-button mk-home-button--light">Build your team <span aria-hidden>↗</span></Link>
            <Link href={JOIN_TALENT_HREF} className="mk-home-button mk-home-button--outline">Join as talent</Link>
          </div>
          <div className="mk-home-hero__footnote"><span className="mk-live-dot" /> A connected path from first brief to day one</div>
        </div>
        <NetworkVisual />
      </div>
      <a className="mk-home-scroll" href="#solutions"><span /> Explore the platform</a>
    </section>
  );
}

function NetworkVisual() {
  return (
    <div className="mk-network-visual mk-reveal is-in" aria-label="Illustrative global workforce network">
      <div className="mk-network-visual__label"><span className="mk-live-dot" /> Workforce network <small>ILLUSTRATIVE VIEW</small></div>
      <svg className="mk-network-map" viewBox="0 0 680 470" role="img" aria-label="Abstract world map with connected regions">
        <defs>
          <pattern id="mkMapDots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.2" fill="#8CAFEA" opacity=".48" /></pattern>
          <linearGradient id="mkMapShade" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#345C9A" stopOpacity=".65"/><stop offset="1" stopColor="#16366C" stopOpacity=".35"/></linearGradient>
        </defs>
        <g fill="url(#mkMapDots)" stroke="#8AADE8" strokeOpacity=".24" strokeWidth="1.3">
          <path d="m77 91 36-23 54 6 29 22 46 5 18 21-17 21-37 5-12 23-21 4-9 32-24 19-20-12-4-31-24-13-9-29-27-16-9-25 30-9Z" />
          <path d="m222 225 27 10 17 28-7 37-18 31-9 43-21 50-17-11-3-41-18-25 9-41-6-37 18-24 7-20 21 0Z" />
          <path d="m311 84 45-17 45 5 22 19 42-5 30 18 58 2 32 24-13 21-42 4-17 17-34-7-23 17-44-10-26 21-28-11-36 5-20-21-31-5-14-27 13-20-7-26 28-4Z" />
          <path d="m379 204 35 2 29 21 5 35-17 31-7 42-26 37-28-8-13-38-28-28 6-36 23-19 2-29 19-10Z" />
          <path d="m514 325 41-13 34 17 3 25-26 18-36-7-22-18 6-22Z" />
          <path d="m278 77 12-18 21 6-3 17-21 7-9-12Z" />
        </g>
        <g fill="none" stroke="#6FE0D1" strokeWidth="1.6" className="mk-route-lines">
          <path d="M173 164Q274 37 405 130" /><path d="M173 164Q263 250 376 252" /><path d="M405 130Q445 181 376 252" />
        </g>
        <g className="mk-network-points">
          <circle cx="173" cy="164" r="7"/><circle cx="405" cy="130" r="7"/><circle cx="376" cy="252" r="7"/>
        </g>
      </svg>
      <div className="mk-float-card mk-float-card--profile">
        <div className="mk-mini-avatar mk-mini-avatar--one"><span>AK</span></div>
        <div><b>Professional profile</b><small>Skills · experience · readiness</small></div>
        <span className="mk-verified" aria-label="Verified">✓</span>
      </div>
      <div className="mk-float-card mk-float-card--compliance">
        <span className="mk-float-icon">◎</span><div><b>Local requirements</b><small>Compliance context</small></div><span className="mk-state-mark" />
      </div>
      <div className="mk-float-card mk-float-card--payroll">
        <span className="mk-float-icon">↗</span><div><b>Payroll</b><small>One operational layer</small></div>
      </div>
      <div className="mk-network-visual__legend"><span><i /> Talent</span><span><i /> Operations</span><span><i /> Markets</span></div>
    </div>
  );
}

function TrustBand() {
  const points = [
    ['01', 'Vetted talent', 'Seven stages before anyone is put forward'],
    ['02', 'Compliant by default', 'Contracts and local requirements handled'],
    ['03', 'One operational layer', 'Hiring, payroll and operations in one place']
  ];
  return (
    <section className="mk-home-proof" aria-label="Kongila approach">
      <div className="mk-wrap mk-home-proof__grid">
        {points.map(([number, title, detail]) => (
          <div className="mk-home-proof__item" key={number}>
            <span className="mk-home-proof__number">{number}</span>
            <div><b>{title}</b><p>{detail}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SolutionExplorer() {
  const [active, setActive] = useState(0);
  const model = SOLUTIONS[active];
  const stages = model.stages;
  return (
    <section className="mk-home-solutions" id="solutions">
      <div className="mk-wrap">
        <div className="mk-home-section-intro mk-reveal">
          <div><p className="mk-home-kicker mk-home-kicker--ink"><span /> Engagement models</p><h2>Choose the way<br />you want to work.</h2></div>
          <p>One talent network. Four ways to build a team, shaped around who employs the person and who directs the work.</p>
        </div>
        <div className="mk-solution-explorer mk-reveal" style={{ ['--model-accent' as any]: model.colour }}>
          <div className="mk-solution-explorer__nav" role="group" aria-label="Select an engagement model">
            {SOLUTIONS.map((solution, index) => (
              <button key={solution.slug} type="button" onClick={() => setActive(index)} aria-pressed={active === index} className={active === index ? 'is-active' : ''}>
                <span>{String(index + 1).padStart(2, '0')}</span>{solution.name}<b aria-hidden>↗</b>
              </button>
            ))}
          </div>
          <div className="mk-solution-explorer__body" key={model.slug}>
            <div className="mk-solution-explorer__copy">
              <span className="mk-home-kicker mk-home-kicker--ink"><span /> {model.name}</span>
              <h3>{model.summary}</h3>
              <p>{model.lede}</p>
              <div className="mk-solution-explorer__facts">
                <div><small>EMPLOYMENT</small><b>{model.split.kongila.includes('payroll') || model.split.kongila.includes('employment') || model.slug !== 'direct-hire' ? 'Kongila' : 'Your team'}</b></div>
                <div><small>DAY-TO-DAY DIRECTION</small><b>{model.slug === 'project-management' || model.slug === 'managed-service' ? 'Kongila' : 'Your team'}</b></div>
              </div>
              <Link href={`/solutions/${model.slug}`} className="mk-home-text-link">Explore {model.name}<span aria-hidden>↗</span></Link>
            </div>
            <SolutionPreview modelName={model.name} stages={stages} index={active} />
          </div>
        </div>
        <p className="mk-home-note"><span>i</span> Not sure which fits? <Link href={startRequestHref()}>Start a request</Link> and we will help you choose before anything is committed.</p>
      </div>
    </section>
  );
}

function SolutionPreview({ modelName, stages, index }: { modelName: string; stages: string[]; index: number }) {
  return (
    <div className={`mk-solution-preview mk-solution-preview--${index + 1}`} aria-label={`Illustrative ${modelName} interface`}>
      <div className="mk-preview-top"><span className="mk-preview-brand"><i /> KONGILA</span><span>ILLUSTRATIVE PREVIEW</span><b>•••</b></div>
      <div className="mk-preview-title"><small>WORKSPACE / {modelName.toUpperCase()}</small><h4>{index === 0 ? 'Professional shortlist' : index === 1 ? 'Your extended team' : index === 2 ? 'Project delivery' : 'Managed function'}</h4></div>
      {index < 2 ? (
        <div className="mk-profile-list">
          {(index === 0 ? ['Skills aligned to role', 'Experience reviewed', 'Remote readiness'] : ['Team requirements', 'Employment setup', 'Work direction']).map((item, i) => (
            <div className="mk-profile-row" key={item}><span className={`mk-mini-avatar mk-mini-avatar--${i + 1}`}>{index === 0 && i === 0 ? '✓' : ''}</span><div><b>{item}</b><small>{index === 0 ? 'Profile review' : 'Engagement detail'}</small></div><span className="mk-row-status">{index === 0 ? 'Reviewed' : 'In scope'}</span></div>
          ))}
        </div>
      ) : (
        <div className="mk-stage-list">
          {stages.slice(0, 4).map((stage, i) => <div key={stage}><span className={i === 0 ? 'is-current' : ''}>{i < 2 ? '✓' : String(i + 1).padStart(2, '0')}</span><b>{stage}</b><i style={{ width: `${82 - i * 13}%` }} /></div>)}
        </div>
      )}
      <div className="mk-preview-bottom"><span><i /> Engagement overview</span><span>↗</span></div>
    </div>
  );
}

function PlatformShowcase() {
  const [active, setActive] = useState(0);
  const capability = PLATFORM_PAGES[active];
  return (
    <section className="mk-home-platform" id="platform">
      <div className="mk-wrap">
        <div className="mk-home-platform__heading mk-reveal">
          <p className="mk-home-kicker"><span /> The Kongila platform</p>
          <h2>The infrastructure<br />behind the work.</h2>
          <p>Talent, compliance, payroll and operations, connected in one place.</p>
        </div>
        <div className="mk-platform-showcase mk-reveal">
          <div className="mk-platform-showcase__menu" role="group" aria-label="Explore platform capabilities">
            {PLATFORM_PAGES.map((item, index) => (
              <button key={item.slug} onClick={() => setActive(index)} type="button" aria-pressed={index === active} className={index === active ? 'is-active' : ''}>
                <CapabilityGlyph index={index} /><span><b>{item.name}</b><small>{item.summary}</small></span><i aria-hidden>↗</i>
              </button>
            ))}
            <div className="mk-platform-showcase__note">Conceptual interface preview. It illustrates the capability, not a live product screen.</div>
          </div>
          <div className="mk-platform-screen" key={capability.slug}>
            <div className="mk-platform-screen__bar"><span><i /> <i /> <i /></span><b>kongila / {capability.slug}</b><small>ILLUSTRATIVE</small></div>
            <div className="mk-platform-screen__content">
              <div className="mk-platform-screen__title"><span>PLATFORM / {String(active + 1).padStart(2, '0')}</span><h3>{capability.name}</h3><p>{capability.summary}</p></div>
              <CapabilityPreview index={active} stages={capability.stages} />
            </div>
          </div>
        </div>
        <div className="mk-home-platform__foot"><span>One connected operating layer</span><Link href="/enterprise">See how it fits together <b aria-hidden>↗</b></Link></div>
      </div>
    </section>
  );
}

function CapabilityGlyph({ index }: { index: number }) {
  const glyphs = [
    <><circle cx="10" cy="8" r="3"/><path d="M4 19c.5-3 2.5-5 6-5s5.5 2 6 5M17 8h4M19 6v4"/></>,
    <><path d="m12 3 7 3v5c0 4-3 7-7 10-4-3-7-6-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></>,
    <><rect x="4" y="6" width="16" height="12" rx="2"/><path d="M4 10h16M8 14h3"/></>,
    <><path d="M5 6h14M5 12h9M5 18h11"/><circle cx="3" cy="6" r=".5"/><circle cx="3" cy="12" r=".5"/><circle cx="3" cy="18" r=".5"/></>,
    <><circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c4 4 4 12 0 16M12 4c-4 4-4 12 0 16"/></>,
    <><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2"/></>
  ];
  return <svg viewBox="0 0 24 24" aria-hidden="true">{glyphs[index]}</svg>;
}

function CapabilityPreview({ index, stages }: { index: number; stages: string[] }) {
  if (index === 0) return (
    <div className="mk-capability-mock mk-capability-mock--talent">
      <div className="mk-mock-profile"><span className="mk-portrait mk-portrait--one"/><div><b>Professional profile</b><small>Skills · experience · availability</small></div><span className="mk-mock-check">✓</span></div>
      <div className="mk-match-line"><span>Requirement</span><i /><b>Shortlist</b></div>
      <div className="mk-skill-chips"><span>Role skills</span><span>Experience</span><span>Remote ready</span></div>
    </div>
  );
  if (index === 1) return (
    <div className="mk-capability-mock mk-capability-mock--compliance">
      <div className="mk-compliance-head"><span>Requirements overview</span><span>Market context</span></div>
      {stages.map((stage, i) => <div className="mk-compliance-row" key={stage}><span className="mk-country-mark">{['GH', 'NG', 'KE'][i % 3]}</span><b>{stage}</b><span>{i === 0 ? 'Contract details' : i === 1 ? 'Local requirements' : 'Documentation'}</span><i /></div>)}
    </div>
  );
  if (index === 2) return (
    <div className="mk-capability-mock mk-capability-mock--payroll">
      <div className="mk-payroll-total"><small>PAYROLL OVERVIEW</small><b>Payment workflow</b><span>Local currency and tax requirements</span></div>
      <div className="mk-payroll-bars"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
      <div className="mk-payroll-labels"><span>Team</span><span>Currency</span><span>Pay cycle</span></div>
    </div>
  );
  if (index === 5) return (
    <div className="mk-capability-mock mk-capability-mock--security"><div className="mk-shield-art"><CapabilityGlyph index={5}/><span /></div><div><b>Workforce information</b><p>Safeguards over the data employers and professionals share.</p><small>Security capability overview</small></div></div>
  );
  return (
    <div className={`mk-capability-mock mk-capability-mock--steps mk-capability-mock--${index}`}>
      <div className="mk-ops-path">{stages.slice(0, 4).map((stage, i) => <div key={stage}><span>{String(i + 1).padStart(2, '0')}</span><b>{stage}</b><i /></div>)}</div>
      <div className="mk-ops-foot"><span>Connected workforce layer</span><b>Details →</b></div>
    </div>
  );
}

function WorkforceJourney() {
  return (
    <section className="mk-home-journey" id="how-it-works">
      <div className="mk-wrap">
        <div className="mk-home-section-intro mk-home-section-intro--journey mk-reveal">
          <div><p className="mk-home-kicker mk-home-kicker--ink"><span /> How it works</p><h2>From first brief<br />to first day.</h2></div>
          <p>Four clear stages. A visible next step at every point.</p>
        </div>
        <div className="mk-journey-track mk-reveal">
          <div className="mk-journey-track__line"><span /></div>
          {JOURNEY.map((step, index) => (
            <article className="mk-journey-step" key={step.label} style={{ ['--step-accent' as any]: step.accent }}>
              <span className="mk-journey-step__number">0{index + 1}</span>
              <div className="mk-journey-step__node"><JourneyGlyph index={index} /></div>
              <p>{step.label}</p><h3>{step.title}</h3><div>{step.body}</div>
            </article>
          ))}
        </div>
        <Link href="/how-it-works" className="mk-home-text-link">See all six stages <span aria-hidden>↗</span></Link>
      </div>
    </section>
  );
}

function JourneyGlyph({ index }: { index: number }) {
  const paths = [
    <><path d="M5 6h14M5 12h10M5 18h7"/><circle cx="19" cy="17" r="2"/></>,
    <><circle cx="10" cy="10" r="5"/><path d="m14 14 5 5M7 10h6"/></>,
    <><rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8 12 2.5 2.5L16 9"/></>,
    <><path d="M4 12h14M13 6l6 6-6 6"/><circle cx="5" cy="12" r="2"/></>
  ];
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[index]}</svg>;
}

function AudienceSplit() {
  return (
    <section className="mk-home-audiences">
      <article className="mk-audience mk-audience--employers">
        <div className="mk-audience__inner">
          <div className="mk-audience__copy mk-reveal">
            <p className="mk-home-kicker"><span /> For employers</p>
            <h2>Your next team<br />starts here.</h2>
            <p>We handle the hiring, compliance and payroll behind it. You decide who joins and what they work on.</p>
            <ul><li>Define the role, skills and location</li><li>Review a screened shortlist</li><li>Handle contracts, onboarding and payroll in one place</li></ul>
            <Link href={startRequestHref()} className="mk-home-button mk-home-button--light">Hire talent <span aria-hidden>↗</span></Link>
          </div>
          <EmployerIllustration />
        </div>
      </article>
      <article className="mk-audience mk-audience--talent">
        <div className="mk-audience__inner mk-audience__inner--reverse">
          <TalentIllustration />
          <div className="mk-audience__copy mk-reveal">
            <p className="mk-home-kicker mk-home-kicker--ink"><span /> For professionals</p>
            <h2>Your skills can<br />take you further.</h2>
            <p>Get matched to roles that fit your skills, wherever they are based. Your profile is checked and verified, not just self-reported.</p>
            <ul><li>Build a profile and complete verification</li><li>Get matched on what you can do</li><li>Work with organisations beyond your local market</li></ul>
            <Link href={JOIN_TALENT_HREF} className="mk-home-button mk-home-button--blue">Join the talent network <span aria-hidden>↗</span></Link>
          </div>
        </div>
      </article>
    </section>
  );
}

function EmployerIllustration() {
  return (
    <div className="mk-employer-art mk-reveal" aria-label="Illustrative hiring workspace">
      <div className="mk-employer-art__window"><div className="mk-window-bar"><span>Hiring workspace</span><small>ILLUSTRATIVE</small></div><div className="mk-workspace-title"><span>ROLE / OPEN</span><b>Shortlist review</b></div>
        <div className="mk-workspace-candidate"><span className="mk-portrait mk-portrait--two"/><div><b>Professional profile</b><small>Skills and experience reviewed</small></div><i>✓</i></div>
        <div className="mk-workspace-candidate"><span className="mk-portrait mk-portrait--three"/><div><b>Professional profile</b><small>Availability and readiness</small></div><i>✓</i></div>
        <div className="mk-workspace-footer"><span>Contracts</span><span>Onboarding</span><span>Payroll</span></div>
      </div>
      <span className="mk-employer-stamp">One connected<br/>workforce layer</span>
    </div>
  );
}

function TalentIllustration() {
  return (
    <div className="mk-talent-art mk-reveal" aria-label="Illustration of a professional profile and global opportunities">
      <div className="mk-talent-art__orbit mk-talent-art__orbit--one"/><div className="mk-talent-art__orbit mk-talent-art__orbit--two"/>
      <svg className="mk-talent-art__person" viewBox="0 0 300 340" role="img" aria-label="Illustrated professional portrait">
        <path d="M34 322c11-78 48-117 116-117s105 39 116 117" fill="#164CA6"/><path d="M92 205c9 25 25 39 58 39s49-14 58-39v-28H92z" fill="#9A5B40"/>
        <ellipse cx="150" cy="126" rx="72" ry="84" fill="#9A5B40"/><path d="M76 125c-8-64 19-104 73-106 59-3 83 40 74 104-12-8-21-21-28-40-31 29-66 43-119 42Z" fill="#171F2B"/>
        <path d="M127 148c8 7 16 7 24 0" fill="none" stroke="#4B2B24" strokeWidth="4" strokeLinecap="round"/><circle cx="124" cy="122" r="4" fill="#171F2B"/><circle cx="176" cy="122" r="4" fill="#171F2B"/>
        <path d="m133 218 17 24 17-24" fill="#fff"/><path d="M88 227 150 340H39c6-54 22-91 49-113Zm124 0-62 113h111c-6-54-22-91-49-113Z" fill="#0D397D"/>
      </svg>
      <div className="mk-talent-tag mk-talent-tag--verified"><span>✓</span> Profile verified</div>
      <div className="mk-talent-tag mk-talent-tag--opportunity"><i/> Opportunities beyond borders</div>
      <div className="mk-talent-art__caption">Your experience, seen for what it is.</div>
    </div>
  );
}

function Questions() {
  return (
    <section className="mk-home-questions">
      <div className="mk-wrap mk-home-questions__layout">
        <div className="mk-reveal"><p className="mk-home-kicker mk-home-kicker--ink"><span /> Good to know</p><h2>Questions worth<br />answering first.</h2><p>The four things most people want settled before they get in touch.</p></div>
        <div className="mk-question-list mk-reveal">
          {QUESTIONS.map((question, index) => (
            <details key={question.q} open={index === 0}><summary><span>{question.q}</span><i aria-hidden>+</i></summary><p>{question.a}</p></details>
          ))}
        </div>
      </div>
    </section>
  );
}
