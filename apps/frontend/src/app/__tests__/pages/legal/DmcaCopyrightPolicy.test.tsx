import React from 'react';
import { render, screen } from '@testing-library/react';
import DmcaCopyrightPolicy from '@/app/features/legal/pages/DmcaCopyrightPolicy';

describe('DmcaCopyrightPolicy', () => {
  it('renders the DMCA policy header and copyright agent details', () => {
    render(<DmcaCopyrightPolicy />);

    expect(
      screen.getByRole('heading', { name: 'DMCA Copyright Policy', level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByText('Effective date: 28.9.2024')).toBeInTheDocument();
    expect(screen.getByText('Last updated: June 2026')).toBeInTheDocument();
    expect(screen.getByText(/Digital Millennium Copyright Act/i)).toBeInTheDocument();
    expect(screen.getByText(/DMCA Notice - Attn: Copyright Agent/i)).toBeInTheDocument();
    expect(screen.getByText('Copyright Agent')).toBeInTheDocument();
    expect(screen.getByText('DuneXploration UG (haftungsbeschränkt)')).toBeInTheDocument();
    expect(screen.getByText('Am Finther Weg 7')).toBeInTheDocument();
    expect(screen.getByText('Mainz, 55127')).toBeInTheDocument();
    expect(screen.getByText('Germany')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'dmca@yosemitecrew.com' })[0]).toHaveAttribute(
      'href',
      'mailto:dmca@yosemitecrew.com'
    );
  });

  it('renders notice requirements without response, repeat infringer, or counter-notification copy', () => {
    render(<DmcaCopyrightPolicy />);

    expect(
      screen.getByRole('heading', { name: 'Required Elements of a Takedown Notice' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'What Happens After You Submit a Notice' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Repeat Infringer Policy' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Counter-Notification/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(
      screen.queryByText(/remove or disable access to the identified content/i)
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /Yosemite Crew is not a law firm and this page does not constitute legal advice/i
      )
    ).toBeInTheDocument();
  });
});
