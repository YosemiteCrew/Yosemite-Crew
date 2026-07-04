import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DmcaCopyrightPolicy from '@/app/features/legal/pages/DmcaCopyrightPolicy';

describe('DmcaCopyrightPolicy', () => {
  beforeEach(() => render(<DmcaCopyrightPolicy />));

  it('renders the DMCA policy title, meta and copyright agent details', () => {
    expect(
      screen.getByRole('heading', { name: 'DMCA Copyright Policy', level: 1 })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Effective 28 September 2024 · Last updated June 2026/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Copyright agent')).toBeInTheDocument();
    expect(screen.getByText(/DuneXploration UG \(haftungsbeschränkt\)/)).toBeInTheDocument();
    expect(screen.getByText(/Am Finther Weg 7/)).toBeInTheDocument();
    expect(screen.getByText(/Mainz, 55127/)).toBeInTheDocument();
  });

  it('renders the takedown notice requirements and submission instructions', () => {
    expect(
      screen.getByRole('heading', { name: 'Required elements of a takedown notice', level: 2 })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getByText(/Digital Millennium Copyright Act/i)).toBeInTheDocument();
    expect(screen.getByText(/DMCA Notice - Attn: Copyright Agent/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Yosemite Crew is not a law firm and this page is not legal advice/i)
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'dmca@yosemitecrew.com' })[0]).toHaveAttribute(
      'href',
      'mailto:dmca@yosemitecrew.com'
    );
  });
});
