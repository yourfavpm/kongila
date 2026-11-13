/**
 * One page per engagement model.
 *
 * Four pages from one file, because their shape is identical and only the
 * content differs — which is the point. A visitor comparing Direct Hire with
 * Managed Service should meet the same questions in the same order on both,
 * answered differently. Written as four separate files they would diverge,
 * and the comparison would get harder exactly where it matters most.
 *
 * Statically generated, so the four URLs are real pages for search and for
 * anyone pasting a link, rather than a client-side lookup.
 */

import React from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';
import Link from 'next/link';
import MarketingPage from '../../components/marketing/SiteChrome';
import {
  Hero,
  Section,
  SectionHead,
  StageStrip,
  ResponsibilitySplit,
  IndicatorCard,
  ClosingCta,
  KonNote
} from '../../components/marketing/blocks';
import { SOLUTIONS, SolutionModel, startRequestHref } from '../../components/marketing/siteMap';

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: SOLUTIONS.map(s => ({ params: { slug: s.slug } })),
  fallback: false
});

export const getStaticProps: GetStaticProps<{ model: SolutionModel }> = async ctx => {
  const slug = String(ctx.params?.slug || '');
  const model = SOLUTIONS.find(s => s.slug === slug);
  if (!model) return { notFound: true };
  return { props: { model } };
};

export default function SolutionPage({ model }: { model: SolutionModel }) {
  const others = SOLUTIONS.filter(s => s.slug !== model.slug);

  if (model.slug === 'direct-hire') return <DirectHirePage model={model} others={others} />;
  if (model.slug === 'talent-outsourcing') return <TalentOutsourcingPage model={model} others={others} />;
  if (model.slug === 'project-management') return <ProjectManagementPage model={model} others={others} />;

  return (
    <MarketingPage title={model.name} description={model.lede}>
      <Hero
        eyebrow="Solutions"
        title={model.name}
        lede={model.lede}
        actions={[
          { href: startRequestHref(model.slug), label: 'Start a request', kind: 'primary' },
          { href: '/how-it-works', label: 'How it works', kind: 'ghost' }
        ]}
        footnote={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="mk-indicator" style={{ background: model.colour, margin: 0 }} />
            <span style={{ fontSize: 13, color: '#6B7A99' }}>
              Requests filed under this model are tracked separately, even when you ask for several roles at once.
            </span>
          </div>
        }
      />

      {/* Who does what. The question every visitor is actually asking. */}
      <Section tint>
        <SectionHead
          title="Where the line sits"
          lede="The models differ in one thing above all: who carries the employment relationship, and who directs the work."
        />
        <ResponsibilitySplit kongila={model.split.kongila} you={model.split.you} colour={model.colour} />
      </Section>

      {/* The path. */}
      <Section>
        <SectionHead
          title={`How ${model.name} runs`}
          lede="Each stage has an owner and a next step. You are never waiting without knowing what for."
          align="left"
          maxWidth={560}
        />
        <StageStrip stages={model.stages} colour={model.colour} />

        <div style={{ marginTop: 34 }}>
          <KonNote state="pointing">
            Every stage shows up in your portal as it happens, so you can see where a request has got to
            without asking anyone.
          </KonNote>
        </div>
      </Section>

      {/* The other three, so the comparison is one click away. */}
      <Section tint>
        <SectionHead title="The other three models" lede="All four draw from the same talent network." />
        <div className="mk-grid mk-grid--3 mk-reveal">
          {others.map(s => (
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
        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <Link href="/solutions" className="mk-btn mk-btn--ghost">Compare all four</Link>
        </div>
      </Section>

      <ClosingCta
        title={`Start with ${model.name}`}
        body="Tell us the role, the skills and where the work needs to happen. We will take it from there."
        primary={{ href: startRequestHref(model.slug), label: 'Start a request' }}
        secondary={{ href: '/solutions', label: 'See all solutions' }}
      />
    </MarketingPage>
  );
}

function DirectHirePage({ model, others }: { model: SolutionModel; others: SolutionModel[] }) {
  return (
    <MarketingPage title="Direct Hire" description="Kongila sources and screens professionals for your role. You interview, choose, and hire them directly onto your payroll.">
      <div className="mk-direct-hire">
        <section className="dh-hero">
          <div className="mk-wrap dh-hero__grid">
            <div className="dh-hero__copy mk-reveal is-in">
              <p className="dh-kicker"><span /> DIRECT HIRE · TALENT DISCOVERY</p>
              <h1>Exceptional people.<br /><em>Found for</em> your next big move.</h1>
              <p className="dh-hero__lede">Kongila finds and screens professionals for your role. You meet the shortlist, make the hiring decision, and welcome your new teammate onto your own payroll.</p>
              <div className="dh-actions">
                <Link href={startRequestHref(model.slug)} className="dh-button dh-button--primary">Start a request <span aria-hidden>↗</span></Link>
                <Link href="/how-it-works" className="dh-button dh-button--outline">How it works</Link>
              </div>
              <div className="dh-hero__note"><span className="dh-check">✓</span> You choose who joins your team.</div>
            </div>
            <TalentDiscoveryHero />
          </div>
          <div className="dh-hero__foot"><span>01 / A CLEARER WAY TO HIRE</span><a href="#discovery">Scroll to explore <b>↓</b></a></div>
        </section>

        <section className="dh-discovery" id="discovery">
          <div className="mk-wrap">
            <div className="dh-section-head mk-reveal"><div><p className="dh-kicker dh-kicker--dark"><span/> TALENT DISCOVERY</p><h2>From a wide search<br/>to the right shortlist.</h2></div><p>Start with what the role actually needs. Kongila sources and screens against your requirements, so your team can spend its time meeting the people who fit.</p></div>
            <DiscoveryFlow />
          </div>
        </section>

        <section className="dh-responsibility">
          <div className="mk-wrap dh-responsibility__layout">
            <div className="dh-responsibility__heading mk-reveal"><p className="dh-kicker"><span/> A CLEAR DIVISION OF WORK</p><h2>We find the fit.<br/><em>You make the call.</em></h2><p>Direct Hire keeps the decision and employment relationship with you.</p></div>
            <div className="dh-responsibility__flow mk-reveal">
              <div className="dh-party dh-party--kongila"><div className="dh-party__mark">K</div><div><small>KONGILA</small><b>Find and prepare talent</b></div><ul><li>Source professionals</li><li>Screen against your requirements</li><li>Prepare the shortlist</li></ul></div>
              <div className="dh-flow-arrow" aria-hidden><span/>SHORTLIST <b>→</b></div>
              <div className="dh-party dh-party--client"><div className="dh-party__mark">Y</div><div><small>YOUR TEAM</small><b>Choose who joins</b></div><ul><li>Interview candidates</li><li>Make the final selection</li><li>Employ directly on your payroll</li></ul></div>
            </div>
          </div>
        </section>

        <section className="dh-journey">
          <div className="mk-wrap">
            <div className="dh-section-head dh-section-head--journey mk-reveal"><div><p className="dh-kicker dh-kicker--dark"><span/> THE HIRING JOURNEY</p><h2>Five steps.<br/>One considered decision.</h2></div><p>See each stage as your request progresses. Your portal keeps the next step in view.</p></div>
            <HiringPipeline />
          </div>
        </section>

        <section className="dh-dashboard">
          <div className="mk-wrap dh-dashboard__layout">
            <div className="dh-dashboard__copy mk-reveal"><p className="dh-kicker"><span/> YOUR HIRING WORKSPACE</p><h2>A clear view of<br/>every next step.</h2><p>Follow a request from role definition through shortlist, interviews and your hiring decision.</p><p className="dh-disclaimer">Illustrative workspace concept — not a live product screen.</p><Link href={startRequestHref(model.slug)} className="dh-inline-link">Start a Direct Hire request <b aria-hidden>↗</b></Link></div>
            <HiringDashboard />
          </div>
        </section>

        <section className="dh-close">
          <div className="mk-wrap dh-close__inner mk-reveal"><div><p className="dh-kicker"><span/> YOUR NEXT GREAT HIRE</p><h2>Make room for<br/><em>the right person.</em></h2><p>Tell us about the role. We’ll help you find the people worth meeting.</p></div><Link href={startRequestHref(model.slug)} className="dh-button dh-button--light">Start a request <span aria-hidden>↗</span></Link></div>
        </section>

        <section className="dh-more"><div className="mk-wrap dh-more__inner"><p>Exploring other ways to work with Kongila?</p><div>{others.map(s => <Link key={s.slug} href={`/solutions/${s.slug}`}>{s.name}<span aria-hidden>↗</span></Link>)}<Link href="/solutions">Compare all models<span aria-hidden>↗</span></Link></div></div></section>
      </div>
    </MarketingPage>
  );
}

const PORTRAITS = ['/images/direct-hire/profile-ama.webp', '/images/direct-hire/profile-kofi.webp', '/images/direct-hire/profile-zuri.webp'];

function Portrait({ index, className = '' }: { index: number; className?: string }) {
  return <span className={`dh-portrait dh-portrait--${index + 1} ${className}`}><img src={PORTRAITS[index % PORTRAITS.length]} alt="" onError={event => { event.currentTarget.style.display = 'none'; }} /></span>;
}

function TalentDiscoveryHero() {
  return (
    <div className="dh-hero-visual mk-reveal is-in" aria-label="Illustrative talent discovery interface">
      <div className="dh-hero-visual__orb dh-hero-visual__orb--one"/><div className="dh-hero-visual__orb dh-hero-visual__orb--two"/>
      <div className="dh-search-card"><div className="dh-search-card__top"><span className="dh-product-mark">K</span><b>Talent discovery</b><span>CONCEPT</span></div><div className="dh-search-card__query"><small>YOUR ROLE</small><b>Senior Product Designer</b><span>Experience · product thinking · remote readiness</span></div><div className="dh-search-card__filters"><i>Product design</i><i>Research</i><i>Remote ready</i></div><div className="dh-search-card__rule"/><div className="dh-search-card__result"><Portrait index={0}/><div><b>Professional profile</b><span>Product design · Research</span></div><strong>SCREENED</strong></div><div className="dh-search-card__result dh-search-card__result--muted"><Portrait index={1}/><div><b>Professional profile</b><span>Product strategy · UX</span></div><span className="dh-status-soft">IN REVIEW</span></div><div className="dh-search-card__bottom"><span><i/> Screening against role requirements</span><b>Shortlist <span>→</span></b></div></div>
      <div className="dh-float-note dh-float-note--fit"><span>✓</span><div><b>Skills aligned</b><small>Role requirements</small></div></div>
      <div className="dh-float-note dh-float-note--shortlist"><span>02</span><div><b>Shortlist prepared</b><small>Ready for your review</small></div></div>
      <div className="dh-hero-visual__caption">A more considered path to your next hire</div>
    </div>
  );
}

function DiscoveryFlow() {
  return <div className="dh-discovery-flow mk-reveal"><div className="dh-discovery-flow__pool"><div className="dh-flow-label">ROLE REQUIREMENTS <span>SCREENING</span></div><div className="dh-role-query"><b>Senior Product Designer</b><small>Skills · experience · remote readiness</small></div><div className="dh-candidate-stack">{[0,1,2].map((n) => <div className={`dh-candidate dh-candidate--${n+1}`} key={n}><Portrait index={n}/><span><b>Professional profile</b><small>{['Product design · Research','UX strategy · Systems','Product thinking · Delivery'][n]}</small></span><i>{n === 0 ? '✓' : '·'}</i></div>)}</div></div><div className="dh-discovery-flow__connector"><span>SCREEN</span><i/><b>→</b></div><div className="dh-shortlist"><div className="dh-flow-label">YOUR SHORTLIST <span>FOR REVIEW</span></div><div className="dh-shortlist__main"><Portrait index={0}/><div><b>Professional profile</b><small>Skills and experience reviewed</small><div className="dh-shortlist__tags"><i>Role fit</i><i>Experience</i></div></div><span className="dh-shortlist__verified">✓</span></div><div className="dh-shortlist__second"><Portrait index={1}/><div><b>Professional profile</b><small>Ready for your review</small></div><span>→</span></div><div className="dh-shortlist__footer">Kongila prepares. <b>You decide.</b></div></div></div>;
}

const HIRING_STAGES = ['Define role','Source','Shortlist','Interview','Hire'];
function HiringPipeline() {
  return <div className="dh-pipeline mk-reveal"><div className="dh-pipeline__track"><span/></div>{HIRING_STAGES.map((stage,index)=><article className={`dh-pipeline__stage${index===4?' dh-pipeline__stage--finish':''}`} key={stage}><small>0{index+1}</small><div className="dh-pipeline__node">{index===4?'✓':<PipelineGlyph index={index}/>}</div><b>{stage}</b><p>{['Set the role and requirements','Kongila searches its network','Review screened professionals','Meet candidates and decide','Your chosen hire joins your payroll'][index]}</p><div className="dh-pipeline__mini">{index===0?<span className="dh-mini-lines"><i/><i/><i/></span>:index===1||index===2?<span className="dh-mini-people"><i/><i/><i/></span>:index===3?<span className="dh-mini-interview"><i/>INTERVIEW</span>:<span className="dh-mini-hired">HIRED <i>✓</i></span>}</div></article>)}</div>;
}

function PipelineGlyph({index}:{index:number}) { const items=[<><path d="M5 6h14M5 12h10M5 18h7"/></>,<><circle cx="10" cy="10" r="5"/><path d="m14 14 5 5"/></>,<><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 10h8M8 14h5"/></>,<><circle cx="9" cy="8" r="3"/><path d="M3 19c.5-3 2.5-5 6-5s5.5 2 6 5m1-8h5m-2.5-2.5v5"/></>]; return <svg viewBox="0 0 24 24" aria-hidden>{items[index]}</svg>; }

function HiringDashboard() {
  return <div className="dh-dashboard-ui mk-reveal"><div className="dh-dashboard-ui__top"><span className="dh-dashboard-ui__brand"><i/> KONGILA</span><span>HIRING WORKSPACE</span><b>•••</b></div><div className="dh-dashboard-ui__body"><aside><small>WORKSPACE</small><b className="is-current">Hiring requests</b><b>Talent network</b><b>Interviews</b><small>DIRECT HIRE</small><span>Senior Product Designer</span></aside><div className="dh-dashboard-ui__main"><div className="dh-dash-title"><div><small>HIRING REQUEST / DIRECT HIRE</small><h3>Senior Product Designer</h3><p>Product · Remote</p></div><span>IN PROGRESS</span></div><div className="dh-dash-stages">{HIRING_STAGES.map((s,i)=><div key={s} className={i<3?'is-done':i===3?'is-active':''}><i>{i<3?'✓':`0${i+1}`}</i><span>{s}</span></div>)}</div><div className="dh-dash-section"><b>Shortlist <small>Prepared for review</small></b><Link href="#discovery">View shortlist</Link></div>{[0,1].map((n)=><div className="dh-dash-profile" key={n}><Portrait index={n}/><div><b>Professional profile</b><small>{n?'Experience reviewed':'Skills aligned to role'}</small></div><span>{n?'Screened':'Ready to review'}</span><b>→</b></div>)}<div className="dh-dash-foot"><span>Next step</span><b>Interview and approve candidates</b><i>→</i></div></div></div><div className="dh-dashboard-ui__disclaimer">Illustrative workspace concept · not a live product screen</div></div>;
}

function TalentOutsourcingPage({model, others}:{model:SolutionModel;others:SolutionModel[]}) {
  return (
    <MarketingPage title="Talent Outsourcing" description="Build a team across borders. Kongila employs and supports the team; your managers direct the day-to-day work.">
      <div className="mk-outsourcing">
        <section className="to-hero"><div className="mk-wrap to-hero__layout"><div className="to-hero__copy mk-reveal is-in"><p className="to-kicker"><span/> TALENT OUTSOURCING · BORDERLESS TEAMS</p><h1>Your next great team<br/><em>doesn’t need</em> to be in one place.</h1><p>Kongila recruits and employs your team, managing payroll, compliance and employment responsibilities. Your managers set priorities and direct the work.</p><div className="to-actions"><Link className="to-btn to-btn--light" href={startRequestHref(model.slug)}>Build your team <b>↗</b></Link><Link className="to-btn to-btn--outline" href="/how-it-works">How it works</Link></div><div className="to-hero__line"><i/> One coordinated team. Employment infrastructure handled.</div></div><GlobalTeamVisual/></div><div className="to-hero__foot"><span>ONE TEAM, ACROSS LOCATIONS</span><a href="#team">Explore the model <b>↓</b></a></div></section>

        <section className="to-team" id="team"><div className="mk-wrap"><div className="to-heading mk-reveal"><div><p className="to-kicker to-kicker--dark"><span/> THE BORDERLESS TEAM</p><h2>Different skills.<br/>One working team.</h2></div><p>Bring the roles your operation needs together, wherever professionals are based. Examples below illustrate team roles; they are not a live roster or availability promise.</p></div><TeamFormation/></div></section>

        <section className="to-relationship"><div className="mk-wrap"><div className="to-heading to-heading--relationship mk-reveal"><div><p className="to-kicker"><span/> WHO OWNS WHICH RESPONSIBILITY</p><h2>Employment, handled.<br/><em>Work, directed by you.</em></h2></div><p>Kongila carries the employment relationship. Your managers lead the work itself, alongside the professionals doing it.</p></div><ThreePartyDiagram/></div></section>

        <section className="to-journey"><div className="mk-wrap"><div className="to-heading mk-reveal"><div><p className="to-kicker to-kicker--dark"><span/> FROM NEED TO OPERATING TEAM</p><h2>Four stages to<br/>a team in motion.</h2></div><p>Define the team, bring the right roles together, establish employment, then get to work with your managers in the lead.</p></div><OutsourcingJourney/></div></section>

        <section className="to-operations"><div className="mk-wrap to-operations__layout"><div className="to-operations__copy mk-reveal"><p className="to-kicker"><span/> ONE WORKFORCE VIEW</p><h2>See the team<br/>and the work around it.</h2><p>A conceptual look at how a distributed team could be represented together. This visual is illustrative, not a live product screen or claim about current interface functionality.</p><Link href={startRequestHref(model.slug)} className="to-text-link">Talk through your team <b>↗</b></Link></div><OperationsMock/></div></section>

        <section className="to-benefits"><div className="mk-wrap"><div className="to-benefits__head mk-reveal"><p className="to-kicker to-kicker--dark"><span/> THE MODEL, AT A GLANCE</p><h2>Build the team.<br/>Skip building the back office.</h2></div><div className="to-benefit-flow"><article className="to-benefit to-benefit--one"><span>01</span><div className="to-benefit__art"><i/><i/><i/></div><h3>Build beyond borders</h3><p>Bring professionals from different locations into one coordinated team.</p></article><article className="to-benefit to-benefit--two"><span>02</span><div className="to-benefit__art"><b>EMPLOYMENT</b><i>Payroll</i><i>Compliance</i></div><h3>Centralize employment</h3><p>Kongila manages payroll, compliance and employment responsibilities.</p></article><article className="to-benefit to-benefit--three"><span>03</span><div className="to-benefit__art"><i>PRIORITIES</i><i>TASKS</i><i>YOUR MANAGERS</i></div><h3>Keep the work close</h3><p>Your managers set priorities and guide the team’s day-to-day work.</p></article></div></div></section>

        <section className="to-close"><div className="mk-wrap to-close__inner mk-reveal"><div><p className="to-kicker"><span/> BRING YOUR NEXT TEAM TOGETHER</p><h2>Build the team.<br/><em>We’ll handle the employment layer.</em></h2><p>Tell us the roles and responsibilities you have in mind. We’ll help you map the right team model.</p></div><Link href={startRequestHref(model.slug)} className="to-btn to-btn--light">Start a request <b>↗</b></Link></div></section>

        <section className="to-more"><div className="mk-wrap to-more__inner"><p>Exploring other ways to work with Kongila?</p><div>{others.map(s=><Link key={s.slug} href={`/solutions/${s.slug}`}>{s.name}<span>↗</span></Link>)}<Link href="/solutions">Compare all models<span>↗</span></Link></div></div></section>
      </div>
    </MarketingPage>
  );
}

function GlobalTeamVisual(){
  return <div className="to-global-visual mk-reveal is-in" aria-label="Illustrative team profiles connected across regions"><div className="to-global-visual__label"><i/> GLOBAL TEAM <small>CONCEPTUAL VIEW</small></div><svg viewBox="0 0 650 410" role="img" aria-label="Abstract map with connected professional locations"><defs><pattern id="toMapDots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.15" fill="#87A9DD" opacity=".46"/></pattern><linearGradient id="toMapFill" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#45689F" stopOpacity=".5"/><stop offset="1" stopColor="#203E6F" stopOpacity=".25"/></linearGradient></defs><g fill="url(#toMapDots)" stroke="#8CAAE0" strokeOpacity=".22" strokeWidth="1"><path d="m71 91 48-28 52 11 35 24 43 7 17 24-26 20-33 4-16 29-22 1-8 28-23 21-19-16-2-30-23-13-11-29-29-10-8-25 25-18Z"/><path d="m220 223 27 6 18 27-7 35-19 34-9 38-17 39-18-12-2-40-17-26 7-36-5-34 19-23 6-8Z"/><path d="m306 83 42-18 47 6 25 18 46-3 30 19 51 2 35 22-17 20-39 5-20 17-33-7-27 15-40-12-28 18-29-12-33 5-18-20-31-7-15-25 12-22-7-23Z"/><path d="m372 205 35 2 29 21 5 34-16 30-8 39-26 37-27-10-13-36-28-27 7-35 22-20 2-25 18-10Z"/><path d="m505 319 40-13 35 18 2 24-24 18-36-7-21-17Z"/></g><g className="to-route-lines" fill="none" stroke="#71D6C8" strokeWidth="1.7"><path d="M164 157Q285 48 414 126"/><path d="M164 157Q272 232 384 244"/><path d="M414 126Q447 188 384 244"/></g><g className="to-map-points"><circle cx="164" cy="157" r="6"/><circle cx="414" cy="126" r="6"/><circle cx="384" cy="244" r="6"/></g></svg><div className="to-location to-location--accra"><Portrait index={0}/><div><b>Professional</b><small>West Africa</small></div></div><div className="to-location to-location--nairobi"><Portrait index={1}/><div><b>Professional</b><small>East Africa</small></div></div><div className="to-location to-location--lagos"><Portrait index={2}/><div><b>Professional</b><small>West Africa</small></div></div><div className="to-team-chip"><span className="to-team-chip__avatars"><Portrait index={0}/><Portrait index={1}/><Portrait index={2}/></span><div><b>One connected team</b><small>Roles come together across locations</small></div><i>↗</i></div><div className="to-global-visual__caption">Illustrative locations · not a live roster</div></div>;
}

const TEAM_ROLES=['Software engineer','Product designer','Operations specialist','Customer support','Business analyst'];
function TeamFormation(){return <div className="to-team-formation mk-reveal"><div className="to-team-formation__orbit"><span/><span/><span/></div><div className="to-role-list">{TEAM_ROLES.map((role,i)=><div className={`to-role to-role--${i+1}`} key={role}><Portrait index={i}/><div><b>{role}</b><small>Example team role</small></div><span>＋</span></div>)}</div><div className="to-formation-center"><span className="to-center-mark">K</span><b>ONE TEAM</b><small>Connected through shared work</small></div><div className="to-formation-note">Illustrative team composition · roles shown as examples</div></div>}

function ThreePartyDiagram(){return <div className="to-three-party mk-reveal"><svg viewBox="0 0 900 150" preserveAspectRatio="none" aria-hidden="true"><path d="M165 45 C340 45 335 112 450 112M735 45C560 45 565 112 450 112"/><path d="M165 45h30M705 45h30M450 112v20"/></svg><div className="to-party to-party--kongila"><span className="to-party-mark">K</span><small>KONGILA</small><h3>Employment infrastructure</h3><ul><li>Employs the professionals</li><li>Handles payroll</li><li>Manages compliance responsibilities</li></ul><span className="to-party-flow">EMPLOYMENT LAYER</span></div><div className="to-party to-party--client"><span className="to-party-mark">C</span><small>CLIENT</small><h3>Day-to-day direction</h3><ul><li>Sets priorities</li><li>Assigns tasks</li><li>Leads the work</li></ul><span className="to-party-flow">WORK DIRECTION</span></div><div className="to-party to-party--team"><span className="to-party-mark">T</span><small>PROFESSIONALS</small><h3>Part of your operation</h3><ul><li>Work as part of your team</li><li>Carry out assigned responsibilities</li></ul><span className="to-party-flow">TEAM DELIVERY</span></div><div className="to-party-link to-party-link--left">EMPLOYS & SUPPORTS <b>→</b></div><div className="to-party-link to-party-link--right">DIRECTS THE WORK <b>→</b></div></div>}

function OutsourcingJourney(){const steps=[['Define team','Roles, responsibilities and team needs.'],['Assemble','Bring the right professional roles together.'],['Employ','Kongila takes on employment responsibilities.'],['Operate','Your managers direct the day-to-day work.']];return <div className="to-journey-track mk-reveal"><div className="to-journey-track__line"><i/></div>{steps.map(([title,body],i)=><article className={`to-journey-step to-journey-step--${i+1}`} key={title}><small>0{i+1}</small><div className="to-journey-art">{i===0?<span className="to-req-lines"><i/><i/><i/></span>:i===1?<span className="to-join-avatars"><Portrait index={0}/><Portrait index={1}/><Portrait index={2}/></span>:i===2?<span className="to-contract-icon">✓<i/><i/></span>:<span className="to-active-team"><i/><i/><i/><b>OPERATING</b></span>}</div><h3>{title}</h3><p>{body}</p></article>)}</div>}

function OperationsMock(){return <div className="to-operations-mock mk-reveal"><div className="to-ops-top"><span className="to-ops-brand"><i/> KONGILA</span><span>WORKFORCE OVERVIEW</span><small>ILLUSTRATIVE CONCEPT</small></div><div className="to-ops-body"><aside><small>TEAM</small><b className="is-active">Directory</b><b>Employment overview</b><b>Payroll</b><b>Compliance</b></aside><div className="to-ops-main"><div className="to-ops-title"><div><small>YOUR TEAM / OUTSOURCING</small><h3>Team overview</h3></div><span>CONCEPT VIEW</span></div><div className="to-ops-summary"><div><small>TEAM ROLES</small><b>Distributed team</b></div><div><small>EMPLOYMENT</small><b>Kongila managed</b></div><div><small>WORK DIRECTION</small><b>Client led</b></div></div><div className="to-ops-table"><div className="to-ops-table__head"><span>PROFESSIONAL</span><span>ROLE</span><span>LOCATION</span><span>EMPLOYMENT</span></div>{TEAM_ROLES.slice(0,3).map((role,i)=><div className="to-ops-row" key={role}><span className="to-ops-person"><Portrait index={i}/><b>Team professional</b></span><span>{role}</span><span>{['West Africa','East Africa','Distributed'][i]}</span><span><i/> Employed by Kongila</span></div>)}</div><div className="to-ops-bottom"><span>Employment administration</span><div><i>Payroll</i><i>Compliance</i><i>Team operations</i></div></div></div></div><div className="to-ops-disclaimer">Conceptual illustration · not a live dashboard or product capability statement</div></div>}

function ProjectManagementPage({model, others}:{model:SolutionModel;others:SolutionModel[]}) {
  return (
    <MarketingPage title="Project Management" description="From a defined project brief to a delivered outcome. Kongila assembles the team, manages the work and coordinates delivery while you set the scope and timeline.">
      <div className="mk-project">
        <section className="pm-hero">
          <div className="mk-wrap pm-hero__layout">
            <div className="pm-hero__copy mk-reveal is-in">
              <p className="pm-kicker"><i/> PROJECT MANAGEMENT · EXECUTION STUDIO</p>
              <h1>Big projects deserve more than <em>good intentions.</em></h1>
              <p>Kongila assembles and manages the team responsible for a defined project. You set the scope and timeline; we coordinate the work through delivery.</p>
              <div className="pm-actions"><Link className="pm-button pm-button--lime" href={startRequestHref(model.slug)}>Start a request <b>↗</b></Link><Link className="pm-button pm-button--quiet" href="/how-it-works">How it works</Link></div>
              <div className="pm-hero__assurance"><span/> One accountable execution partner, from brief to handover.</div>
            </div>
            <ProjectExecutionVisual/>
          </div>
          <div className="mk-wrap pm-hero__foot"><span>DEFINED SCOPE · MANAGED EXECUTION · DELIVERED OUTCOME</span><a href="#project-story">Follow the delivery path <b>↓</b></a></div>
        </section>

        <section className="pm-story" id="project-story">
          <div className="mk-wrap">
            <div className="pm-section-head mk-reveal"><div><p className="pm-kicker pm-kicker--dark"><i/> THE PROJECT, IN MOTION</p><h2>One brief.<br/>A clear path to done.</h2></div><p>Turn a defined objective into an organized plan, bring the right specialists together, then move through execution to a considered handover.</p></div>
            <ProjectStory/>
          </div>
        </section>

        <section className="pm-ownership">
          <div className="mk-wrap pm-ownership__layout">
            <div className="pm-ownership__copy mk-reveal"><p className="pm-kicker"><i/> A DIFFERENT KIND OF PARTNERSHIP</p><h2>You set the destination.<br/><em>We run the delivery.</em></h2><p>Project Management is for a defined piece of work. Kongila assembles the team and manages project execution, while you set the scope and timeline.</p></div>
            <ProjectOwnership/>
          </div>
        </section>

        <section className="pm-journey">
          <div className="mk-wrap">
            <div className="pm-section-head mk-reveal"><div><p className="pm-kicker pm-kicker--dark"><i/> THE DELIVERY SEQUENCE</p><h2>Four moves.<br/>One accountable flow.</h2></div><p>Each stage builds on the last, carrying the project from the agreed brief to work the client can receive and use.</p></div>
            <ProjectJourney/>
          </div>
        </section>

        <section className="pm-dashboard">
          <div className="mk-wrap pm-dashboard__layout">
            <div className="pm-dashboard__copy mk-reveal"><p className="pm-kicker"><i/> A PROJECT, MADE VISIBLE</p><h2>See the work<br/>move forward.</h2><p>A conceptual project view brings workstreams, assigned roles, checkpoints and handover into one visual story. It illustrates the delivery model; it is not a live Kongila dashboard.</p><Link className="pm-inline-link" href={startRequestHref(model.slug)}>Talk through a project <b>↗</b></Link></div>
            <ProjectDashboard/>
          </div>
        </section>

        <section className="pm-milestones">
          <div className="mk-wrap pm-milestones__layout">
            <div className="pm-milestones__visual mk-reveal"><MilestoneShowcase/></div>
            <div className="pm-milestones__copy mk-reveal"><p className="pm-kicker pm-kicker--dark"><i/> CONTROLLED PROGRESS</p><h2>Every checkpoint<br/>has a purpose.</h2><p>Visible stages help make progress easier to follow and handover easier to prepare. The sample timeline is illustrative; project plans and timing are set with each client.</p></div>
          </div>
        </section>

        <section className="pm-compare" id="compare-models">
          <div className="mk-wrap">
            <div className="pm-section-head mk-reveal"><div><p className="pm-kicker pm-kicker--dark"><i/> CHOOSE THE RIGHT MODEL</p><h2>People, a team,<br/>or a delivered project?</h2></div><p>The key difference is who manages the work and what you need at the end.</p></div>
            <ModelComparison/>
          </div>
        </section>

        <section className="pm-close"><div className="mk-wrap pm-close__inner mk-reveal"><div><p className="pm-kicker"><i/> FROM AMBITION TO DELIVERY</p><h2>Let’s turn your next big idea<br/><em>into something delivered.</em></h2><p>Bring us the brief, the scope and the timeline you have in mind.</p></div><Link className="pm-button pm-button--lime" href={startRequestHref(model.slug)}>Start a request <b>↗</b></Link><div className="pm-close__stamp"><span>✓</span><small>DEFINED<br/>HANDOVER</small></div></div></section>

        <section className="pm-more"><div className="mk-wrap pm-more__inner"><p>Compare other ways to work with Kongila.</p><div>{others.map(s=><Link key={s.slug} href={`/solutions/${s.slug}`}>{s.name}<span>↗</span></Link>)}<Link href="/solutions">Compare all models<span>↗</span></Link></div></div></section>
      </div>
    </MarketingPage>
  );
}

function ProjectExecutionVisual(){
  return <div className="pm-execution-visual mk-reveal is-in" aria-label="Illustrative project execution dashboard">
    <div className="pm-execution-visual__orbit pm-execution-visual__orbit--one"/><div className="pm-execution-visual__orbit pm-execution-visual__orbit--two"/>
    <div className="pm-brief-panel"><div className="pm-ui-top"><span className="pm-mark">K</span><b>EXECUTION STUDIO</b><small>CONCEPT VIEW</small></div><div className="pm-brief-panel__content"><small>PROJECT BRIEF / SAMPLE</small><h3>Regional launch toolkit</h3><p>Plan, build and prepare a coordinated market launch.</p><div className="pm-brief-tags"><i>Design</i><i>Content</i><i>Operations</i></div><div className="pm-brief-rule"/><div className="pm-brief-meta"><span>CLIENT SETS <b>Scope + timeline</b></span><span>KONGILA LEADS <b>Project execution</b></span></div></div></div>
    <div className="pm-progress-panel"><div className="pm-progress-panel__top"><span>DELIVERY PATH</span><b><i/> IN PROGRESS</b></div><div className="pm-progress-line"><i/></div><div className="pm-progress-steps"><span className="is-done"><i>✓</i><b>Brief</b></span><span className="is-done"><i>✓</i><b>Plan</b></span><span className="is-active"><i>03</i><b>Execute</b></span><span><i>04</i><b>Handover</b></span></div><div className="pm-progress-panel__bottom"><span><i/> Workstreams coordinated</span><b>ILLUSTRATIVE</b></div></div>
    <div className="pm-assignment-float"><span className="pm-assignment-float__icon">＋</span><div><small>EXAMPLE TEAM</small><b>Design · Build · Review</b></div><span className="pm-assignment-float__signal"/></div>
    <div className="pm-visual-caption">Conceptual project flow · not a live product screen</div>
  </div>;
}

const PROJECT_STAGES=[['The brief','Scope and objectives'],['The plan','Milestones and sequence'],['The team','Specialists assembled'],['Execution','Workstreams progressing'],['The result','Handover prepared']];
function ProjectStory(){return <div className="pm-story-track mk-reveal"><div className="pm-story-track__rail"><i/></div>{PROJECT_STAGES.map(([title,caption],i)=><article className={`pm-story-stage pm-story-stage--${i+1}`} key={title}><span className="pm-story-stage__index">0{i+1}</span><div className="pm-story-stage__art">{i===0?<span className="pm-doc-art"><i/><i/><i/></span>:i===1?<span className="pm-plan-art"><i/><i/><i/></span>:i===2?<span className="pm-team-art"><i/><i/><i/></span>:i===3?<span className="pm-exec-art"><i/><i/><i/></span>:<span className="pm-result-art">✓</span>}</div><h3>{title}</h3><p>{caption}</p></article>)}</div>}

function ProjectOwnership(){return <div className="pm-ownership-diagram mk-reveal"><div className="pm-owner-node pm-owner-node--client"><span>C</span><small>CLIENT DEFINES</small><b>Scope + timeline</b><div><i/> Project boundaries</div><div><i/> Target timing</div></div><div className="pm-owner-connector"><span>AGREED BRIEF</span><i>→</i></div><div className="pm-owner-node pm-owner-node--kongila"><span>K</span><small>KONGILA OWNS</small><b>Project delivery</b><div><i/> Team assembly</div><div><i/> Execution management</div><div><i/> Delivery coordination</div></div><div className="pm-owner-connector pm-owner-connector--result"><span>DEFINED OUTCOME</span><i>→</i></div><div className="pm-owner-node pm-owner-node--outcome"><span>✓</span><small>HANDOVER</small><b>Delivered result</b><div>Prepared for the client</div></div><p className="pm-owner-note">Kongila manages the project work; the client does not need to direct each individual contributor.</p></div>}

function ProjectJourney(){const steps=[['Scope','Agree the brief, boundaries and timeline.'],['Team','Assemble specialists for the defined work.'],['Deliver','Manage workstreams and move through checkpoints.'],['Handover','Prepare the agreed result for the client.']];return <div className="pm-journey-track mk-reveal"><div className="pm-journey-track__rail"><i/></div>{steps.map(([title,copy],i)=><article className={`pm-journey-step pm-journey-step--${i+1}`} key={title}><small>0{i+1}</small><div className="pm-journey-step__visual">{i===0?<span className="pm-scope-art"><i/><i/><i/></span>:i===1?<span className="pm-specialist-art"><i/><i/><i/></span>:i===2?<span className="pm-deliver-art"><i/><i/><b>↗</b></span>:<span className="pm-handover-art">✓</span>}</div><h3>{title}</h3><p>{copy}</p></article>)}</div>}

function ProjectDashboard(){return <div className="pm-dashboard-ui mk-reveal"><div className="pm-dashboard-ui__top"><span className="pm-dashboard-brand"><i/> KONGILA</span><span>PROJECT DELIVERY / CONCEPT</span><small>ILLUSTRATIVE</small></div><div className="pm-dashboard-ui__body"><aside><small>PROJECT</small><b className="is-current">Overview</b><b>Workstreams</b><b>Milestones</b><b>Handover</b><div className="pm-dashboard-aside__status"><i/> Execution view</div></aside><div className="pm-dashboard-main"><div className="pm-dashboard-title"><div><small>PROJECT / SAMPLE BRIEF</small><h3>Regional launch toolkit</h3><p>Defined scope · timeline agreed with client</p></div><span>IN PROGRESS</span></div><div className="pm-dashboard-summary"><div><small>WORKSTREAMS</small><b>03 <i>illustrative</i></b></div><div><small>CHECKPOINT</small><b>Execution</b></div><div><small>HANDOVER</small><b>Preparing</b></div></div><div className="pm-dash-section-title"><b>Delivery sequence</b><small>Sample plan · no dates shown</small></div><div className="pm-dashboard-timeline"><div className="pm-dashboard-timeline__head"><span>BRIEF</span><span>PLAN</span><span>EXECUTE</span><span>HANDOVER</span></div><div className="pm-dashboard-timeline__track"><i/></div><div className="pm-dashboard-timeline__nodes"><i/><i/><i className="is-active"/><i/></div></div><div className="pm-workstreams"><div className="pm-workstreams__head"><span>WORKSTREAM</span><span>LEAD ROLE</span><span>STATUS</span></div><div><b><i className="pm-work-dot pm-work-dot--design"/>Design direction</b><span>Design specialist</span><em>In progress</em></div><div><b><i className="pm-work-dot pm-work-dot--build"/>Build and assembly</b><span>Technical specialist</span><em>Planned</em></div><div><b><i className="pm-work-dot pm-work-dot--review"/>Quality review</b><span>Review specialist</span><em>Upcoming</em></div></div><div className="pm-handover-strip"><span><b>HANDOVER</b><small>Defined deliverable · prepared for client</small></span><i>PREPARING</i></div></div></div><div className="pm-dashboard-disclaimer">Sample project view · illustrative only, not a live product interface or client project</div></div>}

function MilestoneShowcase(){return <div className="pm-milestone-graphic"><div className="pm-milestone-graphic__top"><span>CHECKPOINT MAP</span><small>ILLUSTRATIVE PLAN</small></div><div className="pm-progress-ring"><div><b>03<span>/05</span></b><small>CHECKPOINTS<br/>SHOWN</small></div></div><div className="pm-milestone-route"><i className="is-done"><b>01</b><span>Brief agreed</span><small>COMPLETE</small></i><i className="is-done"><b>02</b><span>Plan aligned</span><small>COMPLETE</small></i><i className="is-active"><b>03</b><span>Work in motion</span><small>ACTIVE</small></i><i><b>04</b><span>Review result</span><small>UP NEXT</small></i><i><b>05</b><span>Handover</span><small>UP NEXT</small></i></div><div className="pm-milestone-graphic__foot"><span><i/> A visible path through the work</span><b>NO DATES IMPLIED</b></div></div>}

const MODEL_COMPARISON=[{slug:'direct-hire',name:'Direct Hire',employer:'Client',manager:'Client manages employee',outcome:'A hire joins your payroll',kind:'hire'},{slug:'talent-outsourcing',name:'Talent Outsourcing',employer:'Kongila',manager:'Client directs daily work',outcome:'A team joins your operation',kind:'outsource'},{slug:'project-management',name:'Project Management',employer:'Kongila assembles team',manager:'Kongila manages project',outcome:'A defined project is delivered',kind:'project'}];
function ModelComparison(){return <div className="pm-model-comparison mk-reveal">{MODEL_COMPARISON.map((item,i)=><article className={`pm-model-column pm-model-column--${item.kind}`} key={item.slug}><div className="pm-model-column__head"><span>0{i+1}</span><h3>{item.name}</h3><i>{item.kind==='project'?'THIS MODEL':'ENGAGEMENT MODEL'}</i></div><div className="pm-model-column__row"><small>WHO EMPLOYS?</small><b>{item.employer}</b></div><div className="pm-model-column__row"><small>WHO MANAGES THE WORK?</small><b>{item.manager}</b></div><div className="pm-model-column__row"><small>WHAT YOU GET</small><b>{item.outcome}</b></div><Link href={`/solutions/${item.slug}`}>{item.kind==='project'?'Current model':'Explore model'} <span>↗</span></Link></article>)}</div>}
