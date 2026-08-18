import { render, screen } from '@testing-library/react';

import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import {
  closeGlassTooltip,
  glassTooltipWrapper,
  openGlassTooltip,
} from '@/app/ui/primitives/GlassTooltip/storyInteractions';

/**
 * Runs the helper the way the browser runs it: with no `act` around it.
 *
 * Wrapping it in `act` looks like the careful thing to do and is actively wrong here.
 * `act` defers React's commit until its scope ends, so the helper's poll - which is the
 * whole point of it - can never observe the portal appearing and it spins until it times
 * out. Measured: 76 dispatches, all delivered to the listener, and the bubble present the
 * instant `act` returned.
 *
 * Clearing the act flag instead silences React's "not wrapped in act" warning (which this
 * repo escalates to a thrown error) while leaving the real commit timing intact.
 */
const outsideAct = async <T,>(fn: () => Promise<T>): Promise<T> => {
  const flag = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = flag.IS_REACT_ACT_ENVIRONMENT;
  flag.IS_REACT_ACT_ENVIRONMENT = false;
  try {
    return await fn();
  } finally {
    flag.IS_REACT_ACT_ENVIRONMENT = previous;
  }
};

const Trigger = ({ content = 'Bubble text' }: { content?: string }) => (
  <GlassTooltip content={content}>
    <button type="button">Hover me</button>
  </GlassTooltip>
);

const trigger = () => screen.getByRole('button', { name: 'Hover me' });

describe('GlassTooltip story interactions', () => {
  it('opens from the control inside the wrapper', async () => {
    render(<Trigger />);
    const bubble = await outsideAct(() => openGlassTooltip(trigger()));
    expect(bubble).toHaveTextContent('Bubble text');
  });

  it('opens from the wrapper itself', async () => {
    render(<Trigger />);
    const bubble = await outsideAct(() => openGlassTooltip(glassTooltipWrapper(trigger())));
    expect(bubble).toBeInTheDocument();
  });

  it('opens on the focus path, which is a separate listener', async () => {
    render(<Trigger />);
    const bubble = await outsideAct(() => openGlassTooltip(trigger(), { via: 'focus' }));
    expect(bubble).toHaveTextContent('Bubble text');
  });

  it('keeps redispatching until a late listener receives one', async () => {
    render(<Trigger />);
    const wrapper = glassTooltipWrapper(trigger());

    // Swallow the first two, the way an unflushed effect does in Storybook. A single
    // dispatch would be lost for good here, which is the bug this helper exists for.
    let swallowed = 0;
    const realDispatch = wrapper.dispatchEvent.bind(wrapper);
    wrapper.dispatchEvent = ((event: Event) => {
      if (event.type === 'mouseenter' && swallowed < 2) {
        swallowed += 1;
        return true;
      }
      return realDispatch(event);
    }) as typeof wrapper.dispatchEvent;

    const bubble = await outsideAct(() => openGlassTooltip(wrapper));
    expect(bubble).toBeInTheDocument();
    expect(swallowed).toBe(2);
  });

  it('closes again and leaves no portalled bubble behind', async () => {
    render(<Trigger />);
    await outsideAct(() => openGlassTooltip(trigger()));
    await outsideAct(() => closeGlassTooltip(trigger()));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('names the control when it has no GlassTooltip around it', () => {
    render(<button type="button">Bare</button>);
    expect(() => glassTooltipWrapper(screen.getByRole('button', { name: 'Bare' }))).toThrow(
      /No .glass-tooltip ancestor for <button>/
    );
  });

  it('reports how many dispatches went unanswered when nothing listens', async () => {
    render(
      <span className="glass-tooltip">
        <button type="button">Inert</button>
      </span>
    );
    await expect(
      outsideAct(() => openGlassTooltip(screen.getByRole('button', { name: 'Inert' })))
    ).rejects.toThrow(/No tooltip opened after \d+ hover dispatch\(es\)/);
  }, 10000);

  it('reports a bubble that never closes', async () => {
    render(<Trigger />);
    await outsideAct(() => openGlassTooltip(trigger()));
    const wrapper = glassTooltipWrapper(trigger());
    // Drop every leave event, so the bubble stays up.
    wrapper.dispatchEvent = (() => true) as typeof wrapper.dispatchEvent;
    await expect(outsideAct(() => closeGlassTooltip(trigger()))).rejects.toThrow(
      /still open 2000ms after leaving the trigger/
    );
  }, 10000);
});
