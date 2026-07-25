'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { DocSection } from '@/app/features/marketing/site';
import type { LegalBlock, LegalCell, LegalInline, LegalSection } from './legalContentTypes';

/** Plain strings need no key; every other run carries its own sibling-unique `k`. */
const inline = (content: readonly LegalInline[]): ReactNode =>
  content.map((run) => {
    if (typeof run === 'string') return run;
    if ('br' in run) return <br key={run.k} />;
    if ('bold' in run) return <strong key={run.k}>{run.text}</strong>;
    if (run.href.startsWith('/')) {
      return (
        <Link key={run.k} href={run.href}>
          {run.text}
        </Link>
      );
    }
    return (
      <a key={run.k} href={run.href}>
        {run.text}
      </a>
    );
  });

const cell = (data: LegalCell) =>
  data.header ? (
    <th key={data.k} scope="row">
      {inline(data.content)}
    </th>
  ) : (
    <td key={data.k}>{inline(data.content)}</td>
  );

const block = (data: LegalBlock): ReactNode => {
  switch (data.type) {
    case 'h3':
      return <h3 key={data.k}>{inline(data.content)}</h3>;
    case 'h4':
      return <h4 key={data.k}>{inline(data.content)}</h4>;
    case 'h5':
      return <h5 key={data.k}>{inline(data.content)}</h5>;
    case 'text':
      return <span key={data.k}>{inline(data.content)}</span>;
    case 'ul':
    case 'ol': {
      const List = data.type;
      return (
        <List key={data.k}>
          {data.items.map((item) => (
            <li key={item.k}>{item.blocks.map(block)}</li>
          ))}
        </List>
      );
    }
    case 'table':
      return (
        <table key={data.k}>
          {data.caption ? <caption className="sr-only">{data.caption}</caption> : null}
          {data.head ? (
            <thead className="sr-only">
              <tr>
                {data.head.map((label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.k}>{row.cells.map(cell)}</tr>
            ))}
          </tbody>
        </table>
      );
    default:
      return <p key={data.k}>{inline(data.content)}</p>;
  }
};

/** Renders the blocks of one legal section. */
export const LegalBlocks = ({ blocks }: Readonly<{ blocks: readonly LegalBlock[] }>) => (
  <>{blocks.map(block)}</>
);

/** Renders a legal document as a run of anchored, titled sections. */
export const LegalSections = ({ sections }: Readonly<{ sections: readonly LegalSection[] }>) => (
  <>
    {sections.map((section) => (
      <DocSection key={section.id} id={section.id} title={section.title}>
        <LegalBlocks blocks={section.blocks} />
      </DocSection>
    ))}
  </>
);
