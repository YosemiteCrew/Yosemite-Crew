import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const notifyMock = jest.fn();
const loadCatalogMock = jest.fn();
const getConfigMock = jest.fn();
const saveConfigMock = jest.fn();

let primaryOrgId: string | null = 'org-1';
let servicesState: unknown[] = [];

jest.mock('@/app/stores/revampCatalogStore', () => ({
  useRevampCatalogStore: (selector: (state: unknown) => unknown) =>
    selector({ services: servicesState, loadOrganisationCatalog: loadCatalogMock }),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: (state: unknown) => unknown) => selector({ primaryOrgId }),
}));

jest.mock('@/app/hooks/useOrgSelectors', () => ({
  usePrimaryOrg: () => ({ name: 'Park Veterinary' }),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: notifyMock }),
}));

jest.mock('@/app/ui/icons/Icon', () => ({
  Icon: () => <span data-testid="icon" />,
}));

jest.mock('@/app/features/websiteBuilder/services/practiceWebsite.service', () => ({
  practiceWebsiteApi: {
    getConfig: (...args: unknown[]) => getConfigMock(...args),
    saveConfig: (...args: unknown[]) => saveConfigMock(...args),
  },
}));

import WebsiteBuilder from '@/app/features/websiteBuilder/pages/WebsiteBuilder/WebsiteBuilder';

const config = (over: Record<string, unknown> = {}) => ({
  organisationId: 'org-1',
  configured: false,
  templateId: 'alpine-clinic',
  headline: 'Park Veterinary',
  tagline: null,
  about: null,
  published: false,
  publishedAt: null,
  slug: 'park-vets',
  publicBookingEnabled: true,
  publicUrl: null,
  ...over,
});

const renderLoaded = async (loaded = config()) => {
  getConfigMock.mockResolvedValue(loaded);
  render(<WebsiteBuilder />);
  await screen.findByLabelText('Headline');
};

describe('WebsiteBuilder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primaryOrgId = 'org-1';
    servicesState = [
      {
        id: 's1',
        name: 'Wellness exam',
        description: '',
        durationMinutes: 30,
        isBookable: true,
        status: 'ACTIVE',
      },
      {
        id: 's2',
        name: 'Hidden item',
        description: '',
        durationMinutes: 10,
        isBookable: false,
        status: 'ACTIVE',
      },
      {
        id: 's3',
        name: 'Archived visit',
        description: '',
        durationMinutes: 10,
        isBookable: true,
        status: 'ARCHIVED',
      },
    ];
    loadCatalogMock.mockResolvedValue(undefined);
  });

  it('shows a loading state, then the saved site for the primary organisation', async () => {
    let resolve: (value: unknown) => void = () => undefined;
    getConfigMock.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<WebsiteBuilder />);

    expect(screen.getByText('Loading your website…')).toBeInTheDocument();

    await act(async () => resolve(config({ headline: 'Caring since 1998' })));

    expect(getConfigMock).toHaveBeenCalledWith('org-1');
    expect(loadCatalogMock).toHaveBeenCalledWith('org-1');
    expect(screen.getByLabelText('Headline')).toHaveValue('Caring since 1998');
    expect(screen.getByText('Draft. Visitors cannot see this site yet.')).toBeInTheDocument();
  });

  it('does not load anything without an organisation', () => {
    primaryOrgId = null;
    render(<WebsiteBuilder />);

    expect(getConfigMock).not.toHaveBeenCalled();
  });

  it('warns when the services for the preview cannot be loaded', async () => {
    getConfigMock.mockResolvedValue(config());
    loadCatalogMock.mockRejectedValue(new Error('network'));
    render(<WebsiteBuilder />);

    await waitFor(() =>
      expect(notifyMock).toHaveBeenCalledWith('warning', {
        title: 'Could not load your services',
        text: 'The preview may be missing services. Refresh to try again.',
      })
    );
  });

  it('says so when the site cannot be loaded', async () => {
    getConfigMock.mockRejectedValue(new Error('network'));
    render(<WebsiteBuilder />);

    expect(await screen.findByRole('alert')).toHaveTextContent('could not load your website');
  });

  it('previews only active, bookable services and the typed copy', async () => {
    await renderLoaded();

    expect(screen.getByText('Wellness exam')).toBeInTheDocument();
    expect(screen.queryByText('Hidden item')).not.toBeInTheDocument();
    expect(screen.queryByText('Archived visit')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Headline'), { target: { value: 'Open late' } });
    expect(screen.getAllByRole('heading', { level: 1 }).at(-1)).toHaveTextContent('Open late');
  });

  it('switches the preview when another template is picked', async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole('radio', { name: /City Vets/ }));

    expect(document.querySelector('[data-template="city-vets"]')).not.toBeNull();
    expect(document.querySelector('[data-template="alpine-clinic"]')).toBeNull();
  });

  it('publishes the trimmed copy, with blank optional fields as null', async () => {
    saveConfigMock.mockResolvedValue(
      config({ published: true, publicUrl: 'https://example.com/site/park-vets' })
    );
    await renderLoaded();

    fireEvent.change(screen.getByLabelText('Headline'), { target: { value: '  Open late  ' } });
    fireEvent.change(screen.getByLabelText(/Tagline/), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText(/About your practice/), {
      target: { value: ' Family practice. ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publish website' }));

    await waitFor(() =>
      expect(saveConfigMock).toHaveBeenCalledWith('org-1', {
        templateId: 'alpine-clinic',
        headline: 'Open late',
        tagline: null,
        about: 'Family practice.',
        published: true,
      })
    );
    expect(await screen.findByText('https://example.com/site/park-vets')).toHaveAttribute(
      'href',
      'https://example.com/site/park-vets'
    );
    expect(notifyMock).toHaveBeenCalledWith('success', {
      title: 'Website saved',
      text: 'Live. Visitors can see this site.',
    });
  });

  it('saves a draft without publishing', async () => {
    saveConfigMock.mockResolvedValue(config({ configured: true }));
    await renderLoaded();

    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() =>
      expect(saveConfigMock).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ published: false })
      )
    );
  });

  it('offers Unpublish and Update for a live site', async () => {
    await renderLoaded(
      config({ published: true, publicUrl: 'https://example.com/site/park-vets' })
    );

    expect(screen.getByRole('button', { name: 'Update website' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Unpublish' })).toBeEnabled();
  });

  it('blocks publishing until online booking is live, and points to its setup', async () => {
    await renderLoaded(config({ publicBookingEnabled: false }));

    expect(screen.getByRole('button', { name: 'Publish website' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Set up online booking' })).toHaveAttribute(
      'href',
      '/public-booking-setup'
    );
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();
  });

  it('explains that a published site is hidden while booking is off', async () => {
    await renderLoaded(config({ published: true, publicBookingEnabled: false }));

    expect(
      screen.getByText('Published, but hidden while online booking is off.')
    ).toBeInTheDocument();
  });

  it('requires a headline before saving', async () => {
    await renderLoaded();

    fireEvent.change(screen.getByLabelText('Headline'), { target: { value: '   ' } });

    expect(screen.getByText('Add a headline for your website.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish website' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Publish website' }));
    expect(saveConfigMock).not.toHaveBeenCalled();
  });

  it('reports a failed save and lets the practice try again', async () => {
    saveConfigMock.mockRejectedValue(new Error('conflict'));
    await renderLoaded();

    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() =>
      expect(notifyMock).toHaveBeenCalledWith('error', {
        title: 'Could not save your website',
        text: 'Nothing was changed. Please try again.',
      })
    );
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();
  });
});
