import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import WhyWeDoThis from '../../../../features/overview/components/WhyWeDoThis';

describe('WhyWeDoThis Component', () => {
  it('1. renders the section and heading correctly', () => {
    render(<WhyWeDoThis />);

    // Assert that the main heading is in the document and is an H2
    const heading = screen.getByRole('heading', {
      level: 2,
      name: /Why we do this/i,
    });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass('WhyWeDoThisTitle');
  });

  it('2. renders the explanatory paragraph text', () => {
    render(<WhyWeDoThis />);

    // Check for specific text snippets to ensure the content loaded
    const firstParagraph = screen.getByText(
      /Most companies keep their numbers private\. We don’t\./i
    );
    expect(firstParagraph).toBeInTheDocument();

    const secondParagraph = screen.getByText(
      /We learned this from open source\. Things improve when they’re visible\./i
    );
    expect(secondParagraph).toBeInTheDocument();
  });

  it('3. renders the image with the correct src and alt attributes', () => {
    render(<WhyWeDoThis />);

    // Find the image specifically by its accessible alt text
    const image = screen.getByRole('img', { name: /Veterinarian with a dog/i });

    // Verify it exists, has the correct external URL, and the right CSS class
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src');
    expect(image.getAttribute('src')).toContain(
      encodeURIComponent('https://d2il6osz49gpup.cloudfront.net/Images/user-overview-image.jpg')
    );
    expect(image).toHaveClass('WhyWeDoThisImage');
  });

  it('4. applies the correct structural CSS grid classes', () => {
    const { container } = render(<WhyWeDoThis />);

    // Verify the outer section wrapper has the correct class
    expect(container.firstChild).toHaveClass('WhyWeDoThisSec');

    // Verify the inner grid and content wrappers exist
    const gridContainer = container.querySelector('.WhyWeDoThisGrid');
    const contentWrapper = container.querySelector('.WhyWeDoThisContent');

    expect(gridContainer).toBeInTheDocument();
    expect(contentWrapper).toBeInTheDocument();
  });
});
