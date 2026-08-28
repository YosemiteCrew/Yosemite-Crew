import type { Metadata } from 'next';
import ConfirmClient from './ConfirmClient';

// Same reasoning as the booking page: per-request so the strict CSP on `/book`
// has a nonce, and never cached, because the answer depends on a token.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Confirm your booking request',
  // The URL carries a confirmation token. Indexing it would put that token in a
  // search index, and following it from there would confirm somebody else's
  // request.
  robots: { index: false, follow: false },
};

const ConfirmPage = () => <ConfirmClient />;

export default ConfirmPage;
