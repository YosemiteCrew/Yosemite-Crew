import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/app/(routes)/(book)/site/[slug]/SiteClient', () => ({
  __esModule: true,
  default: ({ slug }: { slug: string }) => <div data-testid="site-client">{slug}</div>,
}));

import SitePage, { dynamic } from '@/app/(routes)/(book)/site/[slug]/page';

describe('practice website page', () => {
  it('passes the slug from the route to the client', async () => {
    render(await SitePage({ params: Promise.resolve({ slug: 'park-vets' }) }));

    expect(screen.getByTestId('site-client')).toHaveTextContent('park-vets');
  });

  it('renders per request so the strict CSP nonce exists', () => {
    expect(dynamic).toBe('force-dynamic');
  });
});
