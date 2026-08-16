import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SubLabels from '@/app/ui/widgets/Labels/SubLabels';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('SubLabels', () => {
  it('renders a redirect pill for labels with redirect metadata', () => {
    render(
      <SubLabels
        labels={[
          {
            key: 'merck-manuals',
            name: <span>MSD Veterinary Manual</span>,
            redirectHref: '/integrations/merck-manuals',
            redirectLabel: 'Open MSD Veterinary Manual',
          },
        ]}
        activeLabel="merck-manuals"
        setActiveLabel={jest.fn()}
      />
    );

    expect(screen.getByRole('link', { name: 'Open MSD Veterinary Manual' })).toHaveAttribute(
      'href',
      '/integrations/merck-manuals'
    );
  });

  it('renders IDEXX redirect icon inside the logo pill when it is the only sub-label', () => {
    render(
      <SubLabels
        labels={[
          {
            key: 'idexx-labs',
            name: <span>IDEXX</span>,
            redirectHref: '/appointments/idexx-workspace',
            redirectLabel: 'Open IDEXX Hub',
          },
        ]}
        activeLabel="idexx-labs"
        setActiveLabel={jest.fn()}
      />
    );

    const redirectLink = screen.getByRole('link', { name: 'Open IDEXX Hub' });
    expect(redirectLink).toHaveAttribute('href', '/appointments/idexx-workspace');
    expect(redirectLink.closest('div')).toHaveClass('rounded-2xl!');
    expect(redirectLink.closest('div')).toHaveClass('gap-0');
  });

  it('marks sub-sections by shape, not only by hue', () => {
    render(
      <SubLabels
        labels={[
          { key: 'core', name: 'Core' },
          { key: 'history', name: 'History' },
        ]}
        activeLabel="core"
        setActiveLabel={jest.fn()}
        statuses={{ core: 'valid', history: 'error' }}
      />
    );

    // The old markers were a green dot and a red dot whose relative luminance
    // differs by 0.0005 - the same shade in greyscale.
    expect(screen.getByLabelText('Section complete')).toBeInTheDocument();
    expect(screen.getByLabelText('Section has errors')).toBeInTheDocument();
    expect(screen.queryByText('•')).not.toBeInTheDocument();
  });

  it('marks nothing when no statuses are supplied', () => {
    render(
      <SubLabels
        labels={[{ key: 'core', name: 'Core' }]}
        activeLabel="core"
        setActiveLabel={jest.fn()}
      />
    );

    expect(screen.queryByLabelText('Section complete')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Section has errors')).not.toBeInTheDocument();
  });
});
