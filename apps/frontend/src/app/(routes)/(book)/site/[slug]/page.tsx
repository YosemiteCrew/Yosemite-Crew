import type { Metadata } from 'next';
import SiteClient from './SiteClient';

/**
 * A practice's published website.
 *
 * Rendered per request for the same reasons as the booking page next door: it
 * runs under the strict per-request CSP, and a practice can take the site down
 * at any moment, so a cached copy must never outlive that.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Veterinary practice',
};

type SitePageProps = { params: Promise<{ slug: string }> };

const SitePage = async ({ params }: SitePageProps) => {
  const { slug } = await params;
  return <SiteClient slug={slug} />;
};

export default SitePage;
