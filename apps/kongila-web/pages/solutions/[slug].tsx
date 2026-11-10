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
