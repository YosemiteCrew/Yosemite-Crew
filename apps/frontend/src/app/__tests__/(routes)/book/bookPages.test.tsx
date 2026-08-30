import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/app/(routes)/(book)/book/[slug]/BookClient', () => ({
  __esModule: true,
  default: ({ slug }: { slug: string }) => <div data-testid="book-client">{slug}</div>,
}));

jest.mock('@/app/(routes)/(book)/book/[slug]/confirm/ConfirmClient', () => ({
  __esModule: true,
  default: () => <div data-testid="confirm-client" />,
}));

import BookPage, {
  dynamic as bookDynamic,
  metadata as bookMetadata,
} from '@/app/(routes)/(book)/book/[slug]/page';
import ConfirmPage, {
  dynamic as confirmDynamic,
  metadata as confirmMetadata,
} from '@/app/(routes)/(book)/book/[slug]/confirm/page';

describe('public booking pages', () => {
  it('passes the slug from the route to the client', async () => {
    render(await BookPage({ params: Promise.resolve({ slug: 'park-vets' }) }));

    expect(screen.getByTestId('book-client')).toHaveTextContent('park-vets');
  });

  it('renders per request so the strict CSP nonce exists', () => {
    // `middleware.ts` applies the strict policy to `/book`, and that policy
    // needs a per-request nonce. A statically prerendered route has none.
    expect(bookDynamic).toBe('force-dynamic');
    expect(confirmDynamic).toBe('force-dynamic');
  });

  it('lets the booking page be indexed but never the confirmation link', () => {
    // The booking page is published deliberately and holds nobody's personal
    // data. The confirmation URL carries a token, and indexing it would put that
    // token in a search index.
    expect(bookMetadata.robots).toBeUndefined();
    expect(confirmMetadata.robots).toEqual({ index: false, follow: false });
  });

  it('renders the confirmation client', () => {
    render(<ConfirmPage />);
    expect(screen.getByTestId('confirm-client')).toBeInTheDocument();
  });
});
