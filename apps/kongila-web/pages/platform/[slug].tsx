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
