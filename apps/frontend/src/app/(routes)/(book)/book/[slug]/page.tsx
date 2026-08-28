import type { Metadata } from 'next';
import BookClient from './BookClient';

/**
 * Rendered per request, not prerendered.
 *
 * Two reasons, and both matter. The page collects a name, an email address, a
 * phone number and an animal's details, so it must run under the strict CSP that
 * `middleware.ts` applies to `/book` - and that policy needs a per-request nonce,
 * which a statically prerendered route does not have. Second, whether a practice
 * is published can change at any moment, and a cached page would keep serving a
 * booking form for a practice that has taken it down.
 */
export const dynamic = 'force-dynamic';

/**
 * Indexable, unlike the `(share)` pages next door.
 *
 * Those are private records reached by a share token and carry
 * `robots: { index: false }`. This is the opposite: a practice publishes it
 * deliberately so that pet owners can find it, and hiding it from search would
 * defeat the feature. Nothing on the page is anyone's personal data - it is the
 * practice's own name, services and opening times.
 */
export const metadata: Metadata = {
  title: 'Book an appointment',
};

type BookPageProps = { params: Promise<{ slug: string }> };

const BookPage = async ({ params }: BookPageProps) => {
  const { slug } = await params;
  return <BookClient slug={slug} />;
};

export default BookPage;
