/**
 * The legal pages.
 *
 * Plain text on purpose. The approved copy is explicit that these should
 * stay unadorned for clarity and trust, so there is no hero gradient, no
 * mascot and no illustration — just the document, a contents list down the
 * side, and the draft status stated at the top where nobody can miss it.
 *
 * The content is rendered exactly as supplied, placeholders and all.
 */

import React from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';
import Link from 'next/link';
import MarketingPage from '../../components/marketing/SiteChrome';
import { Prose } from '../../components/marketing/blocks';
import { LEGAL_DOCUMENTS, LegalDocument } from '../../components/marketing/legalContent';
import { LEGAL_PAGES } from '../../components/marketing/siteMap';

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: Object.keys(LEGAL_DOCUMENTS).map(slug => ({ params: { slug } })),
  fallback: false
});

export const getStaticProps: GetStaticProps<{ slug: string; doc: LegalDocument }> = async ctx => {
  const slug = String(ctx.params?.slug || '');
  const doc = LEGAL_DOCUMENTS[slug];
  if (!doc) return { notFound: true };
  return { props: { slug, doc } };
};

/** A stable anchor id from a heading, so the contents list can link to it. */
function anchorOf(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export default function LegalPage({ slug, doc }: { slug: string; doc: LegalDocument }) {
  const headings = doc.blocks.filter(b => b.t === 'h2' && b.v).map(b => b.v as string);

  return (
    <MarketingPage title={doc.title} description={doc.description}>
      <div className="mk-wrap" style={{ padding: 'clamp(40px, 5vw, 64px) 24px clamp(56px, 7vw, 88px)' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 240px',
            gap: 48,
            alignItems: 'start'
          }}
          className="mk-legal-grid"
        >
          <div>
            <div className="mk-eyebrow" style={{ marginBottom: 12 }}>Legal</div>
            <h1 className="mk-h1" style={{ fontSize: 'clamp(1.9rem, 1.3rem + 2.2vw, 2.7rem)' }}>{doc.title}</h1>

            {/* The source document's own status line. It says DRAFT, so the
                page says DRAFT. */}
            {doc.status && (
              <div
                style={{
                  marginTop: 20,
                  padding: '13px 16px',
                  borderRadius: 10,
                  background: '#FFFBEB',
                  border: '1px solid #FDE9B9',
                  fontSize: 13,
                  color: '#8A6400',
                  lineHeight: 1.6
                }}
              >
                {doc.status}
              </div>
            )}

            {doc.entity && (
              <p className="mk-small" style={{ marginTop: 16, lineHeight: 1.7 }}>{doc.entity}</p>
            )}
            {doc.note && (
              <p className="mk-small" style={{ marginTop: 10, lineHeight: 1.7, color: '#8795B0' }}>{doc.note}</p>
            )}

            <hr style={{ border: 0, borderTop: '1px solid var(--mk-rule)', margin: '30px 0 8px' }} />

            <Prose>
              {doc.blocks.map((block, i) => {
                if (block.t === 'h2') {
                  return (
                    <h2 key={i} id={anchorOf(block.v || '')} style={{ scrollMarginTop: 90 }}>
                      {block.v}
                    </h2>
                  );
                }
                if (block.t === 'table' && block.rows) {
                  const [head, ...body] = block.rows;
                  return (
                    <table key={i}>
                      <thead>
                        <tr>{head.map((c, j) => <th key={j}>{c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {body.map((row, r) => (
                          <tr key={r}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  );
                }
                return <p key={i}>{block.v}</p>;
              })}
            </Prose>
          </div>

          {/* Contents, and the other policies. */}
          <aside className="mk-legal-aside" style={{ position: 'sticky', top: 92 }}>
            {headings.length > 0 && (
              <>
                <div className="mk-eyebrow" style={{ marginBottom: 12 }}>On this page</div>
                <nav style={{ display: 'grid', gap: 7, marginBottom: 28 }}>
                  {headings.map(h => (
                    <a
                      key={h}
                      href={`#${anchorOf(h)}`}
                      style={{ fontSize: 12.5, lineHeight: 1.5, color: '#6B7A99', textDecoration: 'none' }}
                    >
                      {h}
                    </a>
                  ))}
                </nav>
              </>
            )}

            <div className="mk-eyebrow" style={{ marginBottom: 12 }}>Other policies</div>
            <nav style={{ display: 'grid', gap: 8 }}>
              {LEGAL_PAGES.filter(p => p.slug !== slug).map(p => (
                <Link
                  key={p.slug}
                  href={`/legal/${p.slug}`}
                  style={{ fontSize: 13, color: 'var(--kongila-blue)', textDecoration: 'none' }}
                >
                  {p.name}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 940px) {
          :global(.mk-legal-grid) { grid-template-columns: minmax(0, 1fr) !important; }
          :global(.mk-legal-aside) { position: static !important; order: -1; }
        }
      `}</style>
    </MarketingPage>
  );
}
