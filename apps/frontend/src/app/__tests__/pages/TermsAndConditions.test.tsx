jest.mock(
  '@/app/components/Footer/Footer',
  () =>
    function MockFooter() {
      return <footer>Footer Mock</footer>;
    }
);

jest.mock(
  '@/app/components/Faq/Faq',
  () =>
    function MockFaq() {
      return <div>FAQ Mock</div>;
    }
);

jest.mock('@/app/pages/HomePage/HomePage', () => ({
  FillBtn: ({ text, href }: { text: string; href?: string }) => (
    <a href={href || '#'}>{text}</a>
  ),
}));

jest.mock('@iconify/react/dist/iconify.js', () => ({
  Icon: (props: any) => <span {...props} />,
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import TermsAndConditions from '@/app/pages/TermsAndConditions/TermsAndConditions';

describe('<TermsAndConditions /> – legal content sections', () => {
  beforeEach(() => render(<TermsAndConditions />));

  it('renders the main SaaS title', () => {
    expect(
      screen.getByRole('heading', {
        name: /Yosemite Crew License and Subscription Terms \(SaaS\)/i,
        level: 2,
      })
    ).toBeInTheDocument();
  });

  it('shows Definitions heading', () => {
    const [firstDef] = screen.getAllByRole('heading', {
      name: /1\. DEFINITIONS/i,
    });
    expect(firstDef).toBeInTheDocument();
  });

  it('shows at least one definition entry (1.1 Admin Account)', () => {
    expect(screen.getByText(/^1\.1\. Admin Account$/)).toBeInTheDocument();
  });

  it('renders section 2 heading', () => {
    expect(
      screen.getByRole('heading', { name: /2\. SCOPE/i })
    ).toBeInTheDocument();
  });

  it('shows 2.1 – 2.4 list items', () => {
    expect(screen.getByText(/^2\.1\.$/)).toBeInTheDocument();
    expect(screen.getByText(/^2\.4\.$/)).toBeInTheDocument();
  });

  it('contains the sign-up url', () => {
    const link = screen.getByRole('link', { name: /www\.yosemitecrew\.com/i });
    expect(link).toHaveAttribute('href', 'www.yosemitecrew.com');
  });

  it('renders 5.1.1 – 5.1.7 sub-list', () => {
    expect(screen.getByText(/^5\.1\.1\.$/)).toBeInTheDocument();
    expect(screen.getByText(/^5\.1\.7\.$/)).toBeInTheDocument();
  });

  it('states that payment does NOT influence ranking', () => {
    expect(
      screen.getByText(/Customers cannot influence their ranking.*payment/i)
    ).toBeInTheDocument();
  });

  it('mentions price-increase clause (12 months)', () => {
    expect(
      screen.getByText(/first time after the expiry of 12 months/i)
    ).toBeInTheDocument();
  });

  it('renders 30-day notice for non-renewal', () => {
    expect(
      screen.getByText(/thirty \(30\) days.*notice.*not renew/i)
    ).toBeInTheDocument();
  });

  it('shows 99.99 % availability target', () => {
    expect(screen.getByText(/99\.99%/)).toBeInTheDocument();
  });

  it('shows Severity-1 response time ≤ 2 h', () => {
    expect(screen.getByText(/Within 2 hours/)).toBeInTheDocument();
  });

  it('contains the Data Protection Officer email', () => {
    expect(
      screen.getAllByText(/security@yosemitecrew\.com/i).length
    ).toBeGreaterThan(0);
  });

  it('has no h1 – h2 is the first heading', () => {
    const h1 = screen.queryByRole('heading', { level: 1 });
    expect(h1).not.toBeInTheDocument();
  });

  it('does not render <p> as a direct child of <ol> (hydration safety)', () => {
    const { container } = render(<TermsAndConditions />);
    const illegalParagraphs = container.querySelectorAll('ol > p');
    expect(illegalParagraphs).toHaveLength(0);
  });

  it('matches snapshot', () => {
    const { container } = render(<TermsAndConditions />);
    expect(container).toMatchSnapshot();
  });
});
