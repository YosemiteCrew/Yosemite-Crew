import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import SiteTemplate from '@/app/features/websiteBuilder/components/SiteTemplate';

const practice = {
  name: 'Park Veterinary',
  city: 'Berlin',
  country: 'DE',
  services: [
    { id: 's1', name: 'Wellness exam', description: null, durationMinutes: 30 },
    { id: 's2', name: 'Nail trim', description: null, durationMinutes: 0 },
  ],
};

const content = (over: Record<string, unknown> = {}) => ({
  templateId: 'alpine-clinic' as const,
  headline: 'Caring since 1998',
  tagline: 'Open late',
  about: 'First paragraph\ncontinues here.\n\n\nSecond paragraph.\n\nSecond paragraph.',
  ...over,
});

describe('SiteTemplate', () => {
  it.each(['alpine-clinic', 'city-vets', 'equine-estate'] as const)(
    'renders the %s layout with the copy, services and booking link',
    (templateId) => {
      const { container } = render(
        <SiteTemplate
          content={content({ templateId })}
          practice={practice}
          bookingHref="/book/park-vets"
        />
      );

      expect(container.querySelector(`[data-template="${templateId}"]`)).not.toBeNull();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Caring since 1998');
      expect(screen.getByText('Open late')).toBeInTheDocument();
      expect(screen.getByText('Berlin, DE')).toBeInTheDocument();
      expect(screen.getByText('Wellness exam')).toBeInTheDocument();
      expect(screen.getByText('30 min')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Book an appointment' })).toHaveAttribute(
        'href',
        '/book/park-vets'
      );
    }
  );

  it('splits the about text into paragraphs on blank lines', () => {
    render(<SiteTemplate content={content()} practice={practice} bookingHref={null} />);

    expect(screen.getByText('First paragraph continues here.')).toBeInTheDocument();
    // Two identical paragraphs both render.
    expect(screen.getAllByText('Second paragraph.')).toHaveLength(2);
  });

  it('omits a zero duration, empty sections, the tagline and the place when absent', () => {
    render(
      <SiteTemplate
        content={content({ tagline: null, about: '  \n ' })}
        practice={{ ...practice, city: null, country: null, services: [practice.services[1]] }}
        bookingHref={null}
      />
    );

    expect(screen.getByText('Nail trim')).toBeInTheDocument();
    expect(screen.queryByText(/min$/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'About us' })).not.toBeInTheDocument();
    expect(screen.queryByText('Open late')).not.toBeInTheDocument();
    expect(screen.queryByText('Berlin, DE')).not.toBeInTheDocument();
  });

  it.each(['alpine-clinic', 'city-vets', 'equine-estate'] as const)(
    'hides the services section when there are none (%s)',
    (templateId) => {
      render(
        <SiteTemplate
          content={content({ templateId, tagline: null })}
          practice={{ ...practice, city: 'Berlin', country: null, services: [] }}
          bookingHref={null}
        />
      );

      expect(screen.queryByRole('heading', { name: 'Services' })).not.toBeInTheDocument();
      expect(screen.getByText('Berlin')).toBeInTheDocument();
    }
  );

  it('renders a disabled booking button when there is nowhere to book', () => {
    render(<SiteTemplate content={content()} practice={practice} bookingHref={null} />);

    expect(screen.queryByRole('link', { name: 'Book an appointment' })).not.toBeInTheDocument();
    expect(screen.getByText('Book an appointment')).toHaveAttribute('aria-disabled', 'true');
  });
});
