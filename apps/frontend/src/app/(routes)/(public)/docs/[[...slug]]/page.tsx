import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findBySegments, loadCorpus, slugToSegments } from '@/app/features/docs/corpus';
import { buildDocsNav } from '@/app/features/docs/docsNav';
import { renderDoc } from '@/app/features/docs/render';
import DocsShell from '@/app/features/docs/DocsShell';

/**
 * The public developer documentation.
 *
 * This route lives under `(public)` on purpose. The developer portal at
 * `/developers/*` is wrapped in DevRouteGuard, which redirects anyone
 * unauthenticated to `/developers/signin` - correct for the portal, and wrong
 * for the documentation of an open-source project. Putting these pages inside
 * `(app)` would have silently put the docs behind a login, which reads as
 * working right up until someone opens them signed out.
 *
 * Every page is statically generated from content/docs at build time.
 */

const GITHUB_EDIT_BASE =
  'https://github.com/YosemiteCrew/Yosemite-Crew/blob/dev/apps/frontend/content/docs';

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export function generateStaticParams() {
  /*
   * Exactly one entry per corpus file. The root page carries slug `/`, which
   * IS the empty param array, so it must not be appended separately - doing so
   * emits `[]` twice and Next builds the index page two times.
   */
  return loadCorpus().map((entry) => ({
    slug: entry.segments.length ? entry.segments : undefined,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = findBySegments(slug);
  if (!entry) return { title: 'Not found — Yosemite Crew Developer Docs' };

  return {
    title: `${entry.title} — Yosemite Crew Developer Docs`,
    description: entry.description,
    alternates: { canonical: entry.href },
  };
}

const breadcrumbFor = (slug: string): string[] => {
  if (slug === '/') return ['Docs'];
  return ['Docs', ...slugToSegments(slug).map((part) => part.replaceAll('-', ' '))];
};

export default async function DocsPage({ params }: Readonly<PageProps>) {
  const { slug } = await params;
  const corpus = loadCorpus();
  const entry = findBySegments(slug);

  if (!entry) notFound();

  const [{ tree, toc }, nav] = await Promise.all([
    renderDoc(entry, corpus),
    Promise.resolve(buildDocsNav(corpus)),
  ]);

  return (
    <DocsShell
      nav={nav}
      toc={toc}
      title={entry.title}
      breadcrumb={breadcrumbFor(entry.slug)}
      tree={tree}
      editUrl={`${GITHUB_EDIT_BASE}/${entry.file}`}
    />
  );
}
