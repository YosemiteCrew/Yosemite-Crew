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

  it('applies the nested font size class when nested=true', () => {
    const { container } = render(
      <SectionContainer title="Nested" nested>
        child
      </SectionContainer>
    );
    const titleEl = container.querySelector('span');
    expect(titleEl?.className).toContain('text-[14px]');
  });

  it('applies the outer font size class when nested=false (default)', () => {
    const { container } = render(<SectionContainer title="Outer">child</SectionContainer>);
    const titleEl = container.querySelector('span');
    expect(titleEl?.className).toContain('text-[15px]');
  });

  it('renders the title as a plain static header (no floating chip / whitebg box)', () => {
    const { container } = render(<SectionContainer title="Organization">child</SectionContainer>);
    const titleEl = container.querySelector('span');
    // The static title is bold on --ink, not an absolutely-positioned blue chip.
    expect(titleEl?.className).toContain('font-bold');
    expect(titleEl?.className).not.toContain('absolute');
    expect(titleEl?.className).not.toContain('whitebg');
    expect(titleEl?.getAttribute('style')).toContain('--ink');
    // The visible title is real content, not aria-hidden decoration.
    expect(titleEl?.getAttribute('aria-hidden')).toBeNull();
  });

  it('applies additional className', () => {
    const { container } = render(
      <SectionContainer title="Test" className="extra-class">
        child
      </SectionContainer>
    );
    expect(container.firstChild).toHaveClass('extra-class');
  });

  it('uses the default top padding', () => {
    const { container } = render(<SectionContainer title="Default">child</SectionContainer>);
    expect(container.firstChild).toHaveClass('pt-5');
  });

  it('tightens the top padding when compactTop is set', () => {
    const { container } = render(
      <SectionContainer title="Compact" compactTop>
        child
      </SectionContainer>
    );
    expect(container.firstChild).toHaveClass('pt-4');
    expect(container.firstChild).not.toHaveClass('pt-5');
  });

  it('honours the titleColor override', () => {
    const { container } = render(
      <SectionContainer title="Coloured" titleColor="var(--color-neutral-900)">
        child
      </SectionContainer>
    );
    const titleEl = container.querySelector('span');
    expect(titleEl?.getAttribute('style')).toContain('--color-neutral-900');
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
    expect(titleEl?.className).not.toContain('text-[15px]');
    expect(titleEl?.getAttribute('style')).toBeNull();
  });

  it('renders the titleSlot alongside the title', () => {
    render(
      <SectionContainer title="With slot" titleSlot={<span>SLOT</span>}>
        child
      </SectionContainer>
    );
    expect(screen.getByText('SLOT')).toBeInTheDocument();
  });
});
