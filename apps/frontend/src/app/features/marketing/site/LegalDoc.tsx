'use client';

import { useState, type ReactNode } from 'react';
import { Reveal } from './motion';

export interface TocEntry {
  id: string;
  label: string;
}

/** One anchored section of a legal/trust document: a serif heading + its prose. */
export const DocSection = ({
  id,
  title,
  children,
}: Readonly<{ id: string; title: string; children: ReactNode }>) => (
  <section id={id}>
    <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>{title}</h2>
    {children}
  </section>
);

interface LegalDocProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Small muted line under the subtitle, e.g. an entity name or a last-updated date. */
  meta?: string;
  toc: readonly TocEntry[];
  /** The document body: a series of <section id="..."><h2>...</h2>...</section> wrapped in .yc-doc. */
  children: ReactNode;
}

/**
 * Shared layout for legal and trust documents: a warm hero band, a sticky
 * in-page table of contents, and the yc-doc prose column.
 */
export function LegalDoc({
  eyebrow,
  title,
  subtitle,
  meta,
  toc,
  children,
}: Readonly<LegalDocProps>) {
  // These documents run to tens of thousands of words, so the contents has to stay
  // reachable on a phone. Below the grid breakpoint it collapses behind a toggle;
  // above it the sticky rail is always open and the toggle is not rendered.
  const [tocOpen, setTocOpen] = useState(false);

  return (
    <div data-yc-theme style={{ background: 'var(--page)', color: 'var(--ink-body)' }}>
      <section
        style={{
          background: 'linear-gradient(180deg, var(--page), var(--inset))',
          padding: '128px 24px 56px',
        }}
      >
        <div
          style={{
            width: 'min(1080px, 100%)',
            margin: '0 auto',
            animation: 'ycHeroUp 0.8s cubic-bezier(0.16,1,0.3,1) both',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--blue-text)',
            }}
          >
            {eyebrow}
          </div>
          <h1
            style={{
              margin: '16px 0 0',
              fontFamily: 'var(--font-newsreader)',
              fontSize: 'clamp(36px, 5vw, 60px)',
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: '-0.055em',
              color: 'var(--ink)',
            }}
          >
            {title}
          </h1>
          <p
            style={{
              margin: '18px 0 0',
              maxWidth: 660,
              fontSize: 18,
              lineHeight: 1.6,
              letterSpacing: '-0.02em',
              color: 'var(--ink-muted)',
            }}
          >
            {subtitle}
          </p>
          {meta ? (
            <div
              style={{
                marginTop: 22,
                fontSize: 14,
                letterSpacing: '-0.01em',
                color: 'var(--ink-faint2)',
              }}
            >
              {meta}
            </div>
          ) : null}
        </div>
      </section>

      <section style={{ background: 'var(--screen)', padding: '24px 24px 80px' }}>
        <div
          data-doc-grid="true"
          style={{
            width: 'min(1080px, 100%)',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '220px 1fr',
            gap: 56,
            alignItems: 'start',
          }}
        >
          <aside
            data-toc="true"
            className="yc-toc"
            style={{ position: 'sticky', top: 100, display: 'flex', flexDirection: 'column' }}
          >
            <div
              className="yc-toc-heading"
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--ink-faint2)',
                paddingLeft: 14,
                marginBottom: 8,
              }}
            >
              On this page
            </div>
            <button
              type="button"
              className="yc-toc-toggle"
              aria-expanded={tocOpen}
              aria-controls="yc-toc-list"
              onClick={() => setTocOpen((open) => !open)}
            >
              On this page
              <span aria-hidden="true">{tocOpen ? '–' : '+'}</span>
            </button>
            <nav id="yc-toc-list" className="yc-toc-list" data-open={tocOpen}>
              {toc.map((entry) => (
                <a key={entry.id} href={`#${entry.id}`} onClick={() => setTocOpen(false)}>
                  {entry.label}
                </a>
              ))}
            </nav>
          </aside>
          <Reveal className="yc-doc">{children}</Reveal>
        </div>
      </section>
    </div>
  );
}
