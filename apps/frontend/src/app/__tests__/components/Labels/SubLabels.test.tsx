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
            name: <span>Merck Manuals</span>,
            redirectHref: '/integrations/merck-manuals',
            redirectLabel: 'Open Merck Manuals',
          },
        ]}
        activeLabel="merck-manuals"
        setActiveLabel={jest.fn()}
      />
    );

    expect(screen.getByRole('link', { name: 'Open Merck Manuals' })).toHaveAttribute(
      'href',
      '/integrations/merck-manuals'
    );
  });
});
