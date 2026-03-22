import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import OverviewHero from '../../../../features/overview/components/OverviewHero';

describe('OverviewHero Component', () => {
  it('1. renders the hero section without crashing', () => {
    render(<OverviewHero />);

    // Assert that the main heading is in the document and is an H1
    const heading = screen.getByRole('heading', {
      level: 1,
      name: /Building in Public for Animal Health/i,
    });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass('OverviewHeroTitle');
  });

  it('2. renders the correct subtitle paragraph text', () => {
    render(<OverviewHero />);

    // Assert that the specific paragraph text is rendered correctly
    const subtitleText = screen.getByText(
      /Yosemite Crew is a free, fully customisable Practice Management System/i
    );
    expect(subtitleText).toBeInTheDocument();
  });

  it('3. applies the correct structural CSS classes', () => {
    const { container } = render(<OverviewHero />);

    // Verify the outer section wrapper has the correct class
    expect(container.firstChild).toHaveClass('OverviewHeroSec');

    // Verify the inner container exists
    // container.querySelector is useful here since we are just checking static structure
    const innerContainer = container.querySelector('.OverviewHeroContainer');
    expect(innerContainer).toBeInTheDocument();
  });
});
