import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const replaceMock = jest.fn();
const getPublicSiteMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

jest.mock('@/app/features/websiteBuilder/services/practiceWebsite.service', () => ({
  getPublicSite: (...args: unknown[]) => getPublicSiteMock(...args),
}));

import SiteClient from '@/app/(routes)/(book)/site/[slug]/SiteClient';

const site = {
  templateId: 'city-vets',
  headline: 'Caring since 1998',
  tagline: null,
  about: null,
  practice: {
    slug: 'park vets',
    name: 'Park Veterinary',
    logoUrl: null,
    welcomeMessage: null,
    city: null,
    country: null,
    bookingWindowDays: 28,
    requiresConfirmation: true,
    services: [],
  },
};

describe('SiteClient', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows a loading state, then the published site linking to its booking page', async () => {
    getPublicSiteMock.mockResolvedValue({ kind: 'site', site });
    render(<SiteClient slug="park-vets" />);

    expect(screen.getByText('Loading this practice’s website')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Caring since 1998');
    expect(getPublicSiteMock).toHaveBeenCalledWith('park-vets');
    expect(screen.getAllByRole('link', { name: 'Book an appointment' })[0]).toHaveAttribute(
      'href',
      '/book/park%20vets'
    );
  });

  it('follows a retired slug to the current one', async () => {
    getPublicSiteMock.mockResolvedValue({ kind: 'redirect', slug: 'new vets' });
    render(<SiteClient slug="park-vets" />);

    await screen.findByText('Loading this practice’s website');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(replaceMock).toHaveBeenCalledWith('/site/new%20vets');
  });

  it('says the site is unavailable when the lookup fails', async () => {
    getPublicSiteMock.mockRejectedValue(new Error('404'));
    render(<SiteClient slug="park-vets" />);

    expect(
      await screen.findByRole('heading', { name: 'This website is not available' })
    ).toBeInTheDocument();
  });

  it('ignores a result that lands after unmount', async () => {
    let resolve: (value: unknown) => void = () => undefined;
    getPublicSiteMock.mockReturnValue(new Promise((r) => (resolve = r)));
    const { unmount } = render(<SiteClient slug="park-vets" />);
    unmount();

    resolve({ kind: 'redirect', slug: 'new-vets' });
    await new Promise((r) => setTimeout(r, 0));
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
