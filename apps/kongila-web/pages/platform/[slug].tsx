/**
 * The six platform pages.
 *
 * Short pages by design. Each answers one question — what does Kongila do
 * about payroll, about compliance, about security — and then gets out of the
 * way. The approved copy for these is a headline and a paragraph, and
 * padding them out with invented detail would be the fastest way to put
 * claims on the site that nobody has approved.
 *
 * Where the copy says a claim needs sign-off first, the page says so plainly
 * instead of quietly implying it. A security page that names no certification
 * is honest; one that implies a certification is a liability.
 */

import React from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';
import Link from 'next/link';
import MarketingPage from '../../components/marketing/SiteChrome';
import Mascot from '../../components/brand/Mascot';
import { Hero, Section, SectionHead, IndicatorCard, StageStrip, ClosingCta } from '../../components/marketing/blocks';
import { PLATFORM_PAGES, PlatformPage, startRequestHref } from '../../components/marketing/siteMap';

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: PLATFORM_PAGES.map(p => ({ params: { slug: p.slug } })),
  fallback: false
});

export const getStaticProps: GetStaticProps<{ page: PlatformPage }> = async ctx => {
  const slug = String(ctx.params?.slug || '');
  const page = PLATFORM_PAGES.find(p => p.slug === slug);
  if (!page) return { notFound: true };
  return { props: { page } };
};

export default function PlatformDetail({ page }: { page: PlatformPage }) {
  const others = PLATFORM_PAGES.filter(p => p.slug !== page.slug).slice(0, 3);

  if (page.slug === 'security') return <SecurityPage page={page} />;
  if (page.slug === 'talent-matching') return <TalentMatchingPage page={page} />;
  if (page.slug === 'compliance') return <CompliancePage page={page} />;

  return (
    <MarketingPage title={page.name} description={page.lede}>
      <Hero
        eyebrow="Platform"
        title={page.heading}
        lede={page.lede}
        actions={[{ href: startRequestHref(), label: 'Talk to an expert' }]}
        footnote={<StageStrip stages={page.stages} colour={page.colour} />}
      />

      {page.pending && (
        <Section style={{ paddingTop: 0 }}>
          <div
            className="mk-reveal"
            style={{
              display: 'flex',
              gap: 14,
              alignItems: 'center',
              padding: '15px 18px',
              borderRadius: 12,
              background: '#FCFDFE',
              border: '1px dashed var(--mk-rule)',
              maxWidth: 620
            }}
          >
            <Mascot state="idle" size={38} label="" />
            <p className="mk-small" style={{ margin: 0 }}>{page.pending}</p>
          </div>
        </Section>
      )}

      <Section tint>
        <SectionHead title="The rest of the platform" lede="These pieces are built to work together rather than to be bought separately." />
        <div className="mk-grid mk-grid--3 mk-reveal">
          {others.map(p => (
            <IndicatorCard
              key={p.slug}
              colour={p.colour}
              title={p.name}
              body={p.summary}
              href={`/platform/${p.slug}`}
              cta="Read more"
            />
          ))}
        </div>
      </Section>

      <ClosingCta
        title="Build your workforce on it"
        body="Tell us what you need and which markets you are operating in."
        primary={{ href: startRequestHref(), label: 'Get Started' }}
        secondary={{ href: '/enterprise', label: 'Enterprise overview' }}
      />
    </MarketingPage>
  );
}

function SecurityPage({page}:{page:PlatformPage}) {
  return (
    <MarketingPage title="Security" description={page.lede}>
      <div className="mk-security">
        <section className="sk-hero">
          <div className="mk-wrap sk-hero__layout">
            <div className="sk-hero__copy mk-reveal is-in"><p className="sk-kicker"><i/> PLATFORM / SECURITY</p><h1>Your workforce data deserves <em>more than basic protection.</em></h1><p>Every hiring decision, employment record and workforce interaction carries information worth protecting. Kongila approaches security as a foundational part of the infrastructure connecting employers and professionals.</p><Link className="sk-button sk-button--blue" href={startRequestHref()}>Talk to an expert <span>↗</span></Link></div>
            <SecurityArchitectureIllustration/>
          </div>
          <div className="mk-wrap sk-hero__foot"><span>THE ARCHITECTURE OF TRUST</span><a href="#security-foundations">Explore the foundations <b>↓</b></a></div>
        </section>

        <section className="sk-foundations" id="security-foundations"><div className="mk-wrap"><div className="sk-section-head mk-reveal"><div><p className="sk-kicker sk-kicker--dark"><i/> SECURITY BY DESIGN</p><h2>Protection is built into<br/>how information moves.</h2></div><p>Three established foundations help protect workforce interactions and support accountability.</p></div><SecurityFoundations/></div></section>

        <section className="sk-layers"><div className="mk-wrap sk-layers__layout"><div className="sk-layers__copy mk-reveal"><p className="sk-kicker"><i/> THE THREE LAYERS OF PROTECTION</p><h2>Guard the doorway.<br/>Protect the passage.<br/><em>Keep the record.</em></h2><p>Access control, encryption in transit and audit trails complement one another across the flow of workforce information.</p></div><SecurityLayerDiagram/></div></section>

        <section className="sk-journey"><div className="mk-wrap"><div className="sk-section-head mk-reveal"><div><p className="sk-kicker sk-kicker--dark"><i/> THROUGH THE WORKFORCE JOURNEY</p><h2>Information matters<br/>at every step.</h2></div><p>Security is relevant whenever workforce information is created, used or shared. These are important moments in the journey, not a claim of additional technical controls.</p></div><SecurityJourney/></div></section>

        <section className="sk-transparency"><div className="mk-wrap sk-transparency__layout"><div className="sk-transparency__statement mk-reveal"><p className="sk-kicker"><i/> RESPONSIBLE TRANSPARENCY</p><h2>Trust begins<br/>with clarity.</h2><span className="sk-statement-mark">“</span></div><div className="sk-transparency__copy mk-reveal"><p>Kongila is clear about the security foundations described here: access control, encryption in transit and audit trails.</p><p>We keep our statements within practices confirmed by the business. No certification, independent audit or security guarantee is claimed on this page.</p><Link href={startRequestHref()} className="sk-text-link">Talk with our team <b>↗</b></Link></div></div></section>

        <section className="sk-platform"><div className="mk-wrap"><div className="sk-section-head mk-reveal"><div><p className="sk-kicker sk-kicker--dark"><i/> PROTECTION ACROSS THE PLATFORM</p><h2>One connected<br/>workforce infrastructure.</h2></div><p>Security sits alongside the platform capabilities employers and professionals use across the workforce journey.</p></div><ConnectedPlatformMap/></div></section>

        <section className="sk-close"><div className="mk-wrap sk-close__inner mk-reveal"><div><p className="sk-kicker"><i/> A FOUNDATION FOR TRUST</p><h2>Build your workforce<br/>on a foundation <em>of trust.</em></h2><p>Tell us about your workforce, the markets you operate in and the security considerations that matter to your organisation.</p></div><div className="sk-close__architecture" aria-hidden="true"><i/><i/><i/><b>K</b></div><Link className="sk-button sk-button--blue" href={startRequestHref()}>Talk to an expert <span>↗</span></Link></div></section>
      </div>
    </MarketingPage>
  );
}

function SecurityArchitectureIllustration(){return <div className="sk-architecture mk-reveal is-in" role="img" aria-label="Illustration of access control, protected information in transit, and accountable activity records around workforce information"><div className="sk-architecture__top"><span>WORKFORCE INFORMATION</span><small>THREE FOUNDATIONS</small></div><div className="sk-architecture__drawing"><svg viewBox="0 0 620 430" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path className="sk-arch-outline sk-arch-outline--outer" d="M310 28 533 150v132L310 405 87 282V150L310 28Z"/><path className="sk-arch-outline sk-arch-outline--mid" d="m310 83 174 96v77L310 353l-174-97v-77l174-96Z"/><path className="sk-arch-outline sk-arch-outline--inner" d="m310 132 123 68v38l-123 68-123-68v-38l123-68Z"/><path className="sk-arch-path" d="M90 215h107m226 0h108M310 29v101m0 176v99"/><path className="sk-arch-path sk-arch-path--mint" d="M112 151h77m242 0h77M112 281h77m242 0h77"/><circle cx="310" cy="215" r="78" className="sk-arch-core"/><circle cx="310" cy="215" r="62" className="sk-arch-core-inner"/><path className="sk-arch-data" d="M278 197h64M278 210h64M278 223h43M278 236h52"/><circle cx="310" cy="189" r="4" className="sk-arch-point"/><circle cx="197" cy="215" r="5" className="sk-arch-point sk-arch-point--blue"/><circle cx="423" cy="215" r="5" className="sk-arch-point sk-arch-point--mint"/><circle cx="310" cy="132" r="5" className="sk-arch-point sk-arch-point--amber"/><circle cx="310" cy="298" r="5" className="sk-arch-point sk-arch-point--blue"/></svg><div className="sk-arch-label sk-arch-label--access"><span>01</span><b>ACCESS CONTROL</b><small>Relevant access</small></div><div className="sk-arch-label sk-arch-label--transit"><span>02</span><b>ENCRYPTION IN TRANSIT</b><small>Protected passage</small></div><div className="sk-arch-label sk-arch-label--account"><span>03</span><b>AUDIT TRAILS</b><small>Activity records</small></div><div className="sk-arch-core-label"><b>K</b><span>WORKFORCE<br/>INFORMATION</span></div></div><div className="sk-architecture__foot"><span>Access <i/> Transit <i/> Accountability</span><b>ILLUSTRATIVE CONCEPT</b></div></div>}

function SecurityFoundations(){return <div className="sk-foundation-map mk-reveal"><div className="sk-foundation-map__line"><i/></div><article className="sk-foundation sk-foundation--access"><span className="sk-foundation__number">01</span><div className="sk-access-art"><i/><i/><i/><b>RELEVANT ACCESS</b></div><p className="sk-foundation__eyebrow">ACCESS CONTROL</p><h3>Right information.<br/>Relevant access.</h3><p>Managing who can access relevant workforce information.</p></article><article className="sk-foundation sk-foundation--transit"><span className="sk-foundation__number">02</span><div className="sk-transit-art"><i/><span>INFORMATION</span><i/><b>›</b></div><p className="sk-foundation__eyebrow">ENCRYPTION IN TRANSIT</p><h3>Protection while<br/>information moves.</h3><p>Protecting information as it moves between systems.</p></article><article className="sk-foundation sk-foundation--audit"><span className="sk-foundation__number">03</span><div className="sk-audit-art"><i/><i/><i/><b>ACTIVITY RECORD</b></div><p className="sk-foundation__eyebrow">AUDIT TRAILS</p><h3>A record for<br/>accountability.</h3><p>Maintaining records of relevant activity for review.</p></article></div>}

function SecurityLayerDiagram(){return <div className="sk-layer-diagram mk-reveal"><div className="sk-layer-diagram__header"><span>INFORMATION FLOW / CONCEPT</span><small>PROTECTION IN COMPLEMENTARY LAYERS</small></div><div className="sk-layer-canvas"><div className="sk-layer-stack"><div className="sk-layer sk-layer--access"><span>01</span><b>ACCESS</b><small>Who can reach the information</small><i>↗</i></div><div className="sk-layer sk-layer--transit"><span>02</span><b>TRANSIT</b><small>Protected while information moves</small><i>↗</i></div><div className="sk-layer sk-layer--audit"><span>03</span><b>ACCOUNTABILITY</b><small>Activity can be traced and reviewed</small><i>↗</i></div></div><div className="sk-layer-flow"><div className="sk-flow-end"><span>EMPLOYER</span><i>INFORMATION</i></div><div className="sk-flow-track"><i/><i/><i/><b>→</b></div><div className="sk-flow-end"><span>WORKFORCE</span><i>INTERACTION</i></div></div><div className="sk-layer-base"><i/>FOUNDATIONAL SECURITY PRACTICES<i/></div></div><div className="sk-layer-diagram__foot"><span>Illustrative architecture · not a technical systems diagram</span><b>ACCESS / IN TRANSIT / ACTIVITY</b></div></div>}

const SECURITY_JOURNEY=[['Talent information','Professional details and skills'],['Hiring & employment','Hiring decisions and employment records'],['Payroll-related information','Information used in payroll processes'],['Workforce administration','The ongoing administration of a workforce'],['Operational activity','Activity throughout the relationship']];
function SecurityJourney(){return <div className="sk-journey-track mk-reveal"><div className="sk-journey-track__rail"><i/></div>{SECURITY_JOURNEY.map(([title,copy],i)=><article className={`sk-journey-step sk-journey-step--${i+1}`} key={title}><small>0{i+1}</small><div className="sk-journey-art">{i===0?<span className="sk-journey-person"><i/><b/></span>:i===1?<span className="sk-journey-doc"><i/><i/><i/></span>:i===2?<span className="sk-journey-pay"><i>¤</i><b/></span>:i===3?<span className="sk-journey-admin"><i/><i/><i/><b/></span>:<span className="sk-journey-active"><i/><i/><i/></span>}</div><h3>{title}</h3><p>{copy}</p></article>)}</div>}

const CONNECTED_PLATFORM=[['Talent Matching','Requirements and shortlists','/platform/talent-matching','matching'],['Compliance','Employment requirements','/platform/compliance','compliance'],['Payroll','Pay and reporting','/platform/payroll','payroll'],['Workforce Operations','Ongoing administration','/platform/workforce-operations','operations'],['Workforce Platform','Connected infrastructure','/platform/workforce-platform','platform']];
function ConnectedPlatformMap(){return <div className="sk-platform-map mk-reveal"><svg viewBox="0 0 1000 330" preserveAspectRatio="none" aria-hidden="true"><path d="M500 165 130 68M500 165 315 45M500 165 690 45M500 165 875 88M500 165 500 300"/><circle cx="500" cy="165" r="5"/><circle cx="130" cy="68" r="4"/><circle cx="315" cy="45" r="4"/><circle cx="690" cy="45" r="4"/><circle cx="875" cy="88" r="4"/><circle cx="500" cy="300" r="4"/></svg><div className="sk-platform-hub"><span>K</span><b>SECURITY</b><small>A FOUNDATION<br/>ACROSS THE PLATFORM</small></div>{CONNECTED_PLATFORM.map(([name,copy,href,key],i)=><Link className={`sk-platform-node sk-platform-node--${key}`} href={href} key={href}><span>0{i+1}</span><b>{name}</b><small>{copy}</small><i>↗</i></Link>)}<p className="sk-platform-map__note">Connected platform illustration · visit each capability for its description</p></div>}

function TalentMatchingPage({page}:{page:PlatformPage}) {
  return (
    <MarketingPage title="Talent Matching" description="Great matching goes beyond job titles. Kongila considers the skills, experience and availability required for your work, helping connect your organisation with professionals who fit the real requirements.">
      <div className="mk-talent-matching">
        <section className="tm-hero"><div className="mk-wrap tm-hero__layout"><div className="tm-hero__copy mk-reveal is-in"><p className="tm-kicker"><i/> PLATFORM / TALENT MATCHING</p><h1>The right talent starts with understanding <em>what you actually need.</em></h1><p>Great matching goes beyond job titles. Kongila considers the skills, experience and availability required for your work, helping connect your organisation with professionals who fit the real requirements.</p><Link href={startRequestHref()} className="tm-button tm-button--blue">Talk to an expert <span>-&gt;</span></Link></div><MatchingStudioIllustration/></div><div className="mk-wrap tm-hero__foot"><span>REQUIREMENT FIRST / PROFESSIONALS IN VIEW</span><a href="#matching-requirement">See how the studio works <b>v</b></a></div></section>

        <section className="tm-requirement" id="matching-requirement"><div className="mk-wrap tm-requirement__layout"><div className="tm-requirement__copy mk-reveal"><p className="tm-kicker tm-kicker--dark"><i/> START WITH THE WORK</p><h2>Define the work before searching for the person.</h2><p>Matching begins by understanding the need behind the role. The clearer the requirement, the more useful the search and shortlist can be.</p></div><RequirementBrief/></div></section>

        <section className="tm-journey"><div className="mk-wrap"><div className="tm-section-head mk-reveal"><div><p className="tm-kicker tm-kicker--dark"><i/> HOW MATCHING WORKS</p><h2>From a broad network<br/>to a relevant shortlist.</h2></div><p>A considered sequence narrows the field against the work itself, so organisations can focus on profiles worth reviewing.</p></div><MatchingJourney/></div></section>

        <section className="tm-relevance"><div className="mk-wrap tm-relevance__layout"><div className="tm-relevance__copy mk-reveal"><p className="tm-kicker"><i/> LOOK BEYOND THE TITLE</p><h2>A good match is more than a similar job title.</h2><p>Skills, experience, availability and role-specific expectations have to be considered together against the actual business requirement.</p></div><RelevanceComposition/></div></section>

        <section className="tm-shortlist"><div className="mk-wrap tm-shortlist__layout"><div className="tm-shortlist__copy mk-reveal"><p className="tm-kicker tm-kicker--dark"><i/> FROM MATCH TO HUMAN DECISION</p><h2>Better shortlists.<br/>More informed decisions.</h2><p>A relevant shortlist helps your organisation spend its attention on professionals whose profiles align with the requirement. Your team reviews the profiles and makes the hiring decision.</p><div className="tm-decision-note"><i/> Kongila helps connect the requirement to relevant profiles. Your organisation decides who to hire.</div></div><ShortlistComposition/></div></section>

        <section className="tm-platform"><div className="mk-wrap"><div className="tm-section-head mk-reveal"><div><p className="tm-kicker tm-kicker--dark"><i/> PART OF A CONNECTED PLATFORM</p><h2>Matching is one part<br/>of the workforce journey.</h2></div><p>Talent Matching sits alongside the connected capabilities that support employers and professionals through workforce operations.</p></div><TalentPlatformMap/></div></section>

        <section className="tm-close"><div className="mk-wrap tm-close__inner mk-reveal"><div><p className="tm-kicker"><i/> THE MATCHING STUDIO</p><h2>Find the people your work<br/><em>actually needs.</em></h2><p>Tell us about the roles, skills and experience your organisation is looking for.</p></div><div className="tm-close__mark" aria-hidden="true"><i/><i/><b>TM</b></div><Link href={startRequestHref()} className="tm-button tm-button--blue">Talk to an expert <span>-&gt;</span></Link></div></section>
      </div>
    </MarketingPage>
  );
}

function MatchingStudioIllustration(){return <div className="tm-studio mk-reveal is-in" role="img" aria-label="Illustration showing a role requirement considered against a set of illustrative professional profiles"><div className="tm-studio__top"><span>THE MATCHING STUDIO</span><small>ILLUSTRATIVE PROFILES</small></div><div className="tm-studio__canvas"><div className="tm-need-sheet"><small>THE NEED</small><b>Role requirements</b><div><i/><span>Skills</span></div><div><i/><span>Experience</span></div><div><i/><span>Availability</span></div><div className="tm-need-sheet__expectation"><span>ROLE EXPECTATIONS</span><b>Defined by the work</b></div></div><div className="tm-studio-flow"><span>REVIEW REQUIREMENTS</span><div><i/><i/><i/></div><b>-&gt;</b></div><div className="tm-profile-field"><div className="tm-profile-field__orbit tm-profile-field__orbit--outer"/><div className="tm-profile-field__orbit tm-profile-field__orbit--inner"/><div className="tm-profile-chip tm-profile-chip--one"><img src="/images/direct-hire/profile-ama.webp" alt=""/><div><b>Profile</b><small>Skills in view</small></div><i/></div><div className="tm-profile-chip tm-profile-chip--two"><img src="/images/direct-hire/profile-kofi.webp" alt=""/><div><b>Profile</b><small>Experience in view</small></div><i/></div><div className="tm-profile-chip tm-profile-chip--three"><img src="/images/direct-hire/profile-zuri.webp" alt=""/><div><b>Profile</b><small>Availability in view</small></div><i/></div><div className="tm-profile-field__core"><b>FIT TO<br/>REQUIREMENT</b><span>PROFILES FOR REVIEW</span></div></div></div><div className="tm-studio__foot"><span>Requirements guide the search.</span><b>NO SCORES / NO AUTOMATED CLAIMS</b></div></div>}

function RequirementBrief(){return <div className="tm-brief mk-reveal"><div className="tm-brief__rail"><span>01</span><i/><b>REQUIREMENT</b></div><div className="tm-brief__content"><div className="tm-brief__heading"><div><small>WORK REQUEST / CONCEPT</small><h3>What does the work call for?</h3></div><span>START HERE</span></div><p className="tm-brief__lede">A role is more than a title. Describe the work and the conditions that matter.</p><div className="tm-brief__dimensions"><article className="tm-brief-dimension tm-brief-dimension--skills"><span>01 / CAPABILITY</span><div className="tm-dimension-art"><i/><i/><i/><b/></div><h4>Required skills</h4><p>The capabilities needed for the work.</p></article><article className="tm-brief-dimension tm-brief-dimension--experience"><span>02 / CONTEXT</span><div className="tm-dimension-art"><b>PAST WORK</b><i/><i/></div><h4>Relevant experience</h4><p>Experience related to the requirement.</p></article><article className="tm-brief-dimension tm-brief-dimension--availability"><span>03 / TIMING</span><div className="tm-dimension-art"><i/><i/><b>AVAILABLE</b></div><h4>Availability</h4><p>When the professional can take on the work.</p></article><article className="tm-brief-dimension tm-brief-dimension--expectations"><span>04 / ROLE FIT</span><div className="tm-dimension-art"><i/><b/><i/></div><h4>Role expectations</h4><p>Requirements specific to this role.</p></article></div></div><div className="tm-brief__foot"><span>Specificity starts with the client’s actual need.</span><i>01 / 04</i></div></div>}

function MatchingJourney(){return <div className="tm-flow mk-reveal"><div className="tm-flow__line"><i/></div><article className="tm-flow-step tm-flow-step--network"><span className="tm-flow-step__no">01</span><div className="tm-network-art"><span/><span/><span/><span/><span/><span/><span/><span/><b>TALENT NETWORK</b></div><small>STARTING POINT</small><h3>Talent network</h3><p>A broad pool of professional profiles.</p></article><div className="tm-flow-connector"><i/><i/><i/><b>-&gt;</b></div><article className="tm-flow-step tm-flow-step--filter"><span className="tm-flow-step__no">02</span><div className="tm-filter-art"><span>SKILLS</span><span>EXPERIENCE</span><span>AVAILABILITY</span><i>-&gt;</i></div><small>AGAINST THE NEED</small><h3>Requirement-based filtering</h3><p>Review relevance against the actual role requirements.</p></article><div className="tm-flow-connector"><i/><i/><i/><b>-&gt;</b></div><article className="tm-flow-step tm-flow-step--shortlist"><span className="tm-flow-step__no">03</span><div className="tm-shortlist-art"><span><img src="/images/direct-hire/profile-ama.webp" alt=""/><b>Profile for review</b><i/></span><span><img src="/images/direct-hire/profile-kofi.webp" alt=""/><b>Profile for review</b><i/></span><span><img src="/images/direct-hire/profile-zuri.webp" alt=""/><b>Profile for review</b><i/></span></div><small>FOR YOUR REVIEW</small><h3>Shortlist</h3><p>Profiles aligned with the requirement, presented for your consideration.</p></article></div>}

function RelevanceComposition(){return <div className="tm-relevance-art mk-reveal"><div className="tm-relevance-art__axis"><span>THE REQUIREMENT</span><i/><b>ACTUAL WORK</b></div><div className="tm-relevance-orbit tm-relevance-orbit--one"><div className="tm-relevance-point tm-relevance-point--skills"><b>01</b><span>Skills</span></div><div className="tm-relevance-point tm-relevance-point--experience"><b>02</b><span>Experience</span></div><div className="tm-relevance-point tm-relevance-point--availability"><b>03</b><span>Availability</span></div><div className="tm-relevance-point tm-relevance-point--expectations"><b>04</b><span>Role expectations</span></div><div className="tm-relevance-center"><span>RELEVANCE</span><b>Fit to the<br/>work in view</b></div></div><div className="tm-relevance-art__note">Each dimension matters in context.</div></div>}

function ShortlistComposition(){return <div className="tm-shortlist-ui mk-reveal"><div className="tm-shortlist-ui__top"><span className="tm-shortlist-brand"><i/> PROFILE SHORTLIST</span><small>ILLUSTRATIVE / FOR REVIEW</small></div><div className="tm-shortlist-ui__intro"><div><small>ROLE REQUIREMENT</small><h3>Professionals to consider</h3><p>Profile highlights related to the work</p></div><span>CLIENT REVIEW</span></div><div className="tm-profile-feature"><img src="/images/direct-hire/profile-ama.webp" alt=""/><div><small>ILLUSTRATIVE PROFILE</small><b>Professional profile</b><span>Skills relevant to the role</span><div><i>Skill alignment</i><i>Related experience</i></div></div><b className="tm-profile-feature__index">01</b></div><div className="tm-profile-rows"><div><span>02</span><img src="/images/direct-hire/profile-kofi.webp" alt=""/><b>Professional profile</b><small>Experience related to the requirement</small><i>For review</i></div><div><span>03</span><img src="/images/direct-hire/profile-zuri.webp" alt=""/><b>Professional profile</b><small>Availability considered</small><i>For review</i></div></div><div className="tm-shortlist-ui__foot"><span>Your organisation reviews and decides.</span><b>ILLUSTRATIVE PROFILES / NOT A LIVE ROSTER</b></div></div>}

const MATCHING_PLATFORM=[['Security','A foundation for workforce data','/platform/security','security'],['Compliance','Employment requirements','/platform/compliance','compliance'],['Payroll','Pay across the workforce','/platform/payroll','payroll'],['Workforce Operations','Ongoing workforce administration','/platform/workforce-operations','operations'],['Workforce Platform','Connected workforce infrastructure','/platform/workforce-platform','platform']];
function TalentPlatformMap(){return <div className="tm-platform-map mk-reveal"><svg viewBox="0 0 1000 340" preserveAspectRatio="none" aria-hidden="true"><path d="M500 170 120 70M500 170 315 40M500 170 690 40M500 170 880 80M500 170 500 310"/><circle cx="500" cy="170" r="5"/><circle cx="120" cy="70" r="4"/><circle cx="315" cy="40" r="4"/><circle cx="690" cy="40" r="4"/><circle cx="880" cy="80" r="4"/><circle cx="500" cy="310" r="4"/></svg><div className="tm-platform-hub"><span>TM</span><b>TALENT MATCHING</b><small>REQUIREMENT<br/>TO SHORTLIST</small></div>{MATCHING_PLATFORM.map(([name,copy,href,key],i)=><Link className={`tm-platform-node tm-platform-node--${key}`} href={href} key={href}><span>0{i+1}</span><b>{name}</b><small>{copy}</small><i>-&gt;</i></Link>)}<p className="tm-platform-map__note">Connected platform illustration · explore each capability</p></div>}

function CompliancePage({page}:{page:PlatformPage}) {
  return (
    <MarketingPage title="Compliance" description="Employment requirements differ across markets. Kongila helps track local requirements, contracts and documentation so organisations can manage distributed workforce employment with greater clarity.">
      <div className="mk-compliance">
        <section className="cm-hero"><div className="mk-wrap cm-hero__layout"><div className="cm-hero__copy mk-reveal is-in"><p className="cm-kicker"><i/> PLATFORM / COMPLIANCE</p><h1>Every market has its own rules. <em>Your workforce should not have to navigate them alone.</em></h1><p>Employment requirements differ across markets. Kongila helps track local requirements, contracts and documentation so organisations can manage the employment side of building a distributed workforce with greater clarity.</p><Link href={startRequestHref()} className="cm-button cm-button--blue">Talk to an expert <span>-&gt;</span></Link></div><ComplianceGlobalIllustration/></div><div className="mk-wrap cm-hero__foot"><span>CONFIDENCE ACROSS BORDERS</span><a href="#local-requirements">See the structure <b>v</b></a></div></section>

        <section className="cm-markets" id="local-requirements"><div className="mk-wrap"><div className="cm-section-head mk-reveal"><div><p className="cm-kicker cm-kicker--dark"><i/> EMPLOYMENT IS NOT THE SAME EVERYWHERE</p><h2>One workforce.<br/>Different local requirements.</h2></div><p>When a team spans markets, employment contracts, local regulations and required documentation may differ. Keeping those details visible is part of managing employment with care.</p></div><MarketRequirementsVisual/></div></section>

        <section className="cm-structure"><div className="mk-wrap"><div className="cm-section-head mk-reveal"><div><p className="cm-kicker cm-kicker--dark"><i/> HOW KONGILA HELPS ORGANISE COMPLIANCE</p><h2>Bring the important<br/>details into view.</h2></div><p>A structured view of contracts, local employment requirements and documentation helps organisations manage the employment side of a distributed workforce.</p></div><ComplianceStructure/></div></section>

        <section className="cm-journey"><div className="mk-wrap"><div className="cm-section-head mk-reveal"><div><p className="cm-kicker"><i/> THROUGH THE EMPLOYMENT JOURNEY</p><h2>Compliance is ongoing,<br/>not a one-time checkbox.</h2></div><p>Employment information can matter at establishment, during changes and throughout the relationship. Keeping records organised remains an ongoing responsibility.</p></div><EmploymentJourney/></div></section>

        <section className="cm-platform"><div className="mk-wrap"><div className="cm-section-head mk-reveal"><div><p className="cm-kicker cm-kicker--dark"><i/> BUILT INTO THE WIDER WORKFORCE SYSTEM</p><h2>Compliance works better<br/>when it is not isolated.</h2></div><p>Employment requirements relate to how a workforce is matched, employed, paid and administered, alongside the security and platform foundations around it.</p></div><CompliancePlatformMap/></div></section>

        <section className="cm-transparency"><div className="mk-wrap cm-transparency__layout"><div className="cm-transparency__copy mk-reveal"><p className="cm-kicker"><i/> RESPONSIBLE, TRANSPARENT COMPLIANCE</p><h2>Clarity starts with<br/><em>what is confirmed.</em></h2><p>Kongila does not list a country or jurisdiction here until the supported markets and services have been confirmed. We do not claim legal advice, automatic legal monitoring, guaranteed compliance outcomes or regulatory approvals.</p></div><div className="cm-coverage-note mk-reveal"><span>01 / MARKET COVERAGE</span><b>Confirmed information<br/>before specific claims.</b><i/><small>Jurisdiction-specific details belong here only when validated.</small></div></div></section>

        <section className="cm-close"><div className="mk-wrap cm-close__inner mk-reveal"><div><p className="cm-kicker"><i/> CONFIDENCE ACROSS BORDERS</p><h2>Build across markets<br/><em>with greater clarity.</em></h2><p>Tell us where your organisation operates and what employment requirements you need to manage.</p></div><div className="cm-close__motif" aria-hidden="true"><i/><i/><i/><b>K</b></div><Link href={startRequestHref()} className="cm-button cm-button--blue">Talk to an expert <span>-&gt;</span></Link></div></section>
      </div>
    </MarketingPage>
  );
}

function ComplianceGlobalIllustration(){return <div className="cm-global mk-reveal is-in" role="img" aria-label="Abstract illustration of one workforce connected to different market contexts, contracts, local requirements and documentation"><div className="cm-global__top"><span>CONNECTED EMPLOYMENT</span><small>ILLUSTRATIVE MARKETS</small></div><div className="cm-global__drawing"><svg viewBox="0 0 640 390" aria-hidden="true"><path d="M318 191 118 91M322 191 512 74M321 200 513 302"/><path d="M318 191 134 296"/><circle cx="318" cy="195" r="74"/><circle cx="318" cy="195" r="56"/><circle cx="118" cy="91" r="6"/><circle cx="512" cy="74" r="6"/><circle cx="513" cy="302" r="6"/><circle cx="134" cy="296" r="6"/></svg><div className="cm-workforce-core"><span>K</span><b>ONE<br/>WORKFORCE</b><small>CONNECTED ORGANISATION</small></div><div className="cm-market-module cm-market-module--one"><small>MARKET CONTEXT</small><b>Contract details</b><i><span/><span/><span/></i></div><div className="cm-market-module cm-market-module--two"><small>LOCAL CONTEXT</small><b>Employment requirements</b><i/><i/><span>REFERENCE</span></div><div className="cm-market-module cm-market-module--three"><small>EMPLOYMENT RECORD</small><b>Documentation</b><i><span/><span/></i></div><div className="cm-market-module cm-market-module--four"><small>WORKFORCE RECORD</small><b>Relevant details</b><i/><span>ORGANIZED</span></div></div><div className="cm-global__foot"><span>EMPLOYMENT DETAILS VARY BY MARKET</span><b>ABSTRACT VIEW / NO JURISDICTIONS SHOWN</b></div></div>}

function MarketRequirementsVisual(){return <div className="cm-markets-visual mk-reveal"><div className="cm-market-context cm-market-context--a"><span>MARKET CONTEXT A</span><div className="cm-context-art"><i/><b>CONTRACT</b><i/></div><p>Employment agreement</p><small>LOCAL REQUIREMENT</small></div><div className="cm-market-context cm-market-context--b"><span>MARKET CONTEXT B</span><div className="cm-context-art"><i/><i/><b>REGULATION</b></div><p>Local employment rules</p><small>LOCAL REQUIREMENT</small></div><div className="cm-market-context cm-market-context--c"><span>MARKET CONTEXT C</span><div className="cm-context-art"><b>RECORD</b><i/><i/><i/></div><p>Required documentation</p><small>LOCAL REQUIREMENT</small></div><div className="cm-market-link"><span>ONE CONNECTED WORKFORCE</span><i/><b>K</b><i/></div><p className="cm-markets-visual__note">Illustrative differences only. No country coverage or specific legal requirements are implied.</p></div>}

function ComplianceStructure(){return <div className="cm-structure-flow mk-reveal"><div className="cm-structure-line"><i/></div><article className="cm-structure-step cm-structure-step--contracts"><span>01</span><div className="cm-structure-art cm-contract-art"><i/><i/><i/><b>AGREEMENT</b></div><small>EMPLOYMENT INFORMATION</small><h3>Contracts</h3><p>Employment agreements and relevant contract information.</p></article><div className="cm-structure-link"><i/><span>-&gt;</span><i/></div><article className="cm-structure-step cm-structure-step--regulations"><span>02</span><div className="cm-structure-art cm-regulation-art"><i/><b>LOCAL</b><i/><small>REQUIREMENTS</small></div><small>MARKET CONTEXT</small><h3>Local regulations</h3><p>Tracking applicable local employment requirements.</p></article><div className="cm-structure-link"><i/><span>-&gt;</span><i/></div><article className="cm-structure-step cm-structure-step--docs"><span>03</span><div className="cm-structure-art cm-doc-art"><i/><i/><i/><b>FILED</b></div><small>EMPLOYMENT RECORDS</small><h3>Documentation</h3><p>Keeping relevant employment documentation organised.</p></article></div>}

const EMPLOYMENT_JOURNEY=[['Establish','Set up the employment relationship.'],['Maintain','Keep employment records organised.'],['Manage changes','Keep relevant details current as things change.'],['Organise documentation','Maintain the information connected to employment.']];
function EmploymentJourney(){return <div className="cm-journey-track mk-reveal"><div className="cm-journey-track__rail"><i/></div>{EMPLOYMENT_JOURNEY.map(([title,copy],i)=><article className={`cm-journey-step cm-journey-step--${i+1}`} key={title}><small>0{i+1}</small><div className="cm-journey-art">{i===0?<span className="cm-journey-contract"><i/><i/><b/></span>:i===1?<span className="cm-journey-record"><i/><i/><i/></span>:i===2?<span className="cm-journey-change"><i/><b>+</b></span>:<span className="cm-journey-files"><i/><i/><i/></span>}</div><h3>{title}</h3><p>{copy}</p></article>)}</div>}

const COMPLIANCE_PLATFORM=[['Talent Matching','Requirements and shortlists','/platform/talent-matching','matching'],['Payroll','Pay and reporting','/platform/payroll','payroll'],['Workforce Operations','Ongoing administration','/platform/workforce-operations','operations'],['Security','A foundation for workforce data','/platform/security','security'],['Workforce Platform','Connected infrastructure','/platform/workforce-platform','platform']];
function CompliancePlatformMap(){return <div className="cm-platform-map mk-reveal"><svg viewBox="0 0 1000 340" preserveAspectRatio="none" aria-hidden="true"><path d="M500 170 120 70M500 170 315 40M500 170 690 40M500 170 880 80M500 170 500 310"/><circle cx="500" cy="170" r="5"/><circle cx="120" cy="70" r="4"/><circle cx="315" cy="40" r="4"/><circle cx="690" cy="40" r="4"/><circle cx="880" cy="80" r="4"/><circle cx="500" cy="310" r="4"/></svg><div className="cm-platform-hub"><span>C</span><b>COMPLIANCE</b><small>EMPLOYMENT<br/>REQUIREMENTS</small></div>{COMPLIANCE_PLATFORM.map(([name,copy,href,key],i)=><Link className={`cm-platform-node cm-platform-node--${key}`} href={href} key={href}><span>0{i+1}</span><b>{name}</b><small>{copy}</small><i>-&gt;</i></Link>)}<p className="cm-platform-map__note">Connected platform illustration · explore each capability</p></div>}
