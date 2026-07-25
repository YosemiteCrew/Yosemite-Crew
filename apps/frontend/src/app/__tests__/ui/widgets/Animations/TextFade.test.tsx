import { render, screen } from '@testing-library/react';
import { useInView } from 'framer-motion';
import { TextFade } from '@/app/ui/widgets/Animations/TextFade';

jest.mock('framer-motion', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  const passthrough = (tag: string) =>
    react.forwardRef(
      (
        { children, variants, initial: _initial, animate, ...rest }: Record<string, unknown>,
        ref: React.Ref<HTMLDivElement>
      ) =>
        react.createElement(
          tag,
          {
            ref,
            'data-animate': animate,
            'data-variants': variants ? JSON.stringify(variants) : undefined,
            ...rest,
          },
          children as React.ReactNode
        )
    );

  return {
    LazyMotion: ({ children }: { children: React.ReactNode }) =>
      react.createElement('div', { 'data-testid': 'lazy-motion' }, children),
    domAnimation: {},
    m: { div: passthrough('div') },
    useInView: jest.fn(),
  };
});

const useInViewMock = useInView as jest.Mock;

describe('TextFade', () => {
  beforeEach(() => {
    useInViewMock.mockReturnValue(true);
  });

  it('renders each valid child inside its own animated wrapper', () => {
    render(
      <TextFade direction="up">
        <span>First</span>
        <span>Second</span>
      </TextFade>
    );

    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByTestId('lazy-motion')).toBeInTheDocument();
  });

  it('passes plain text children through unwrapped', () => {
    const { container } = render(<TextFade direction="up">plain text</TextFade>);
    expect(container).toHaveTextContent('plain text');
  });

  it('shows content once it enters the viewport', () => {
    const { container } = render(
      <TextFade direction="up">
        <span>Visible</span>
      </TextFade>
    );
    expect(container.querySelector('[data-animate="show"]')).toBeInTheDocument();
  });

  it('stays hidden until it enters the viewport', () => {
    useInViewMock.mockReturnValue(false);
    const { container } = render(
      <TextFade direction="up">
        <span>Hidden</span>
      </TextFade>
    );
    expect(container.querySelector('[data-animate="show"]')).not.toBeInTheDocument();
  });

  it('offsets upward children from below', () => {
    const { container } = render(
      <TextFade direction="up">
        <span>Up</span>
      </TextFade>
    );
    const wrapper = container.querySelectorAll('[data-variants]')[1];
    expect(JSON.parse(wrapper.getAttribute('data-variants') ?? '{}').hidden.y).toBe(18);
  });

  it('offsets downward children from above', () => {
    const { container } = render(
      <TextFade direction="down">
        <span>Down</span>
      </TextFade>
    );
    const wrapper = container.querySelectorAll('[data-variants]')[1];
    expect(JSON.parse(wrapper.getAttribute('data-variants') ?? '{}').hidden.y).toBe(-18);
  });

  it('applies the className and the default stagger', () => {
    const { container } = render(
      <TextFade direction="up" className="custom-fade">
        <span>Styled</span>
      </TextFade>
    );
    expect(container.querySelector('.custom-fade')).toBeInTheDocument();
    const root = container.querySelectorAll('[data-variants]')[0];
    expect(
      JSON.parse(root.getAttribute('data-variants') ?? '{}').show.transition.staggerChildren
    ).toBe(0.1);
  });

  it('honours a custom stagger', () => {
    const { container } = render(
      <TextFade direction="up" staggerChildren={0.5}>
        <span>Staggered</span>
      </TextFade>
    );
    const root = container.querySelectorAll('[data-variants]')[0];
    expect(
      JSON.parse(root.getAttribute('data-variants') ?? '{}').show.transition.staggerChildren
    ).toBe(0.5);
  });
});
