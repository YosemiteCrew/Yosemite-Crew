import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';

describe('SectionContainer', () => {
  it('renders the title', () => {
    render(<SectionContainer title="Pricing">content</SectionContainer>);
    expect(screen.getByText('Pricing')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <SectionContainer title="Test">
        <span data-testid="child">child</span>
      </SectionContainer>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('applies nested font size class when nested=true', () => {
    const { container } = render(
      <SectionContainer title="Nested" nested>
        child
      </SectionContainer>
    );
    const titleEl = container.querySelector('span');
    expect(titleEl?.className).toContain('text-[16px]');
  });

  it('applies outer font size class when nested=false (default)', () => {
    const { container } = render(<SectionContainer title="Outer">child</SectionContainer>);
    const titleEl = container.querySelector('span');
    expect(titleEl?.className).toContain('text-[20px]');
  });

  it('applies additional className', () => {
    const { container } = render(
      <SectionContainer title="Test" className="extra-class">
        child
      </SectionContainer>
    );
    expect(container.firstChild).toHaveClass('extra-class');
  });

  it('uses the default roomy top padding', () => {
    const { container } = render(<SectionContainer title="Default">child</SectionContainer>);
    expect(container.firstChild).toHaveClass('pt-9');
  });

  it('tightens the top padding when compactTop is set', () => {
    const { container } = render(
      <SectionContainer title="Compact" compactTop>
        child
      </SectionContainer>
    );
    expect(container.firstChild).toHaveClass('pt-5');
    expect(container.firstChild).not.toHaveClass('pt-9');
  });

  it('applies a custom title typography class and drops the default size/color', () => {
    const { container } = render(
      <SectionContainer title="Styled" titleClassName="text-yc-20-b-primary">
        child
      </SectionContainer>
    );
    const titleEl = container.querySelector('span');
    expect(titleEl?.className).toContain('text-yc-20-b-primary');
    // The default size class and inline colour are not applied when overridden.
    expect(titleEl?.className).not.toContain('text-[20px]');
    expect(titleEl?.getAttribute('style')).toBeNull();
  });
});
