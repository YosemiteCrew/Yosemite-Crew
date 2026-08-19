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

  it('never accepts a stale bubble from a different trigger as its own', async () => {
    render(
      <>
        <GlassTooltip content="First bubble">
          <button type="button">First</button>
        </GlassTooltip>
        <GlassTooltip content="Second bubble">
          <button type="button">Second</button>
        </GlassTooltip>
      </>
    );

    /* Leave the first one open. A presence check ("is a tooltip on screen?") would now
       return instantly for ANY trigger, reporting success without opening anything -
       the exact silent pass this helper exists to remove. */
    const first = await outsideAct(() =>
      openGlassTooltip(screen.getByRole('button', { name: 'First' }))
    );
    expect(first).toHaveTextContent('First bubble');

    const second = await outsideAct(() =>
      openGlassTooltip(screen.getByRole('button', { name: 'Second' }))
    );
    expect(second).toHaveTextContent('Second bubble');
    expect(second).not.toBe(first);
    // Both are open at once, which is why identity rather than presence is the test.
    expect(screen.getAllByRole('tooltip')).toHaveLength(2);
  });

  it('closes the bubble it opened, not merely some bubble', async () => {
    render(
      <>
        <GlassTooltip content="First bubble">
          <button type="button">First</button>
        </GlassTooltip>
        <GlassTooltip content="Second bubble">
          <button type="button">Second</button>
        </GlassTooltip>
      </>
    );
    const firstTrigger = screen.getByRole('button', { name: 'First' });
    await outsideAct(() => openGlassTooltip(firstTrigger));
    await outsideAct(() => openGlassTooltip(screen.getByRole('button', { name: 'Second' })));

    /* Waiting for "no bubbles remain" would hang here forever, because the second one
       is still up and this wrapper's leave events cannot close it. */
    await outsideAct(() => closeGlassTooltip(firstTrigger));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Second bubble');
  });

  it('says so when a leftover bubble is the reason nothing opened', async () => {
    render(
      <>
        <GlassTooltip content="First bubble">
          <button type="button">First</button>
        </GlassTooltip>
        <span className="glass-tooltip">
          <button type="button">Inert</button>
        </span>
      </>
    );
    await outsideAct(() => openGlassTooltip(screen.getByRole('button', { name: 'First' })));
    await expect(
      outsideAct(() => openGlassTooltip(screen.getByRole('button', { name: 'Inert' })))
    ).rejects.toThrow(/1 unrelated bubble\(s\) were already open/);
  }, 10000);

  it('falls back to waiting for an empty screen when it never opened one itself', async () => {
    render(<Trigger />);
    const button = trigger();
    // Opened WITHOUT the helper, so nothing was recorded for this wrapper.
    const wrapper = glassTooltipWrapper(button);
    await outsideAct(async () => {
      wrapper.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
      await new Promise((resolve) => {
        setTimeout(resolve, 60);
      });
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await outsideAct(() => closeGlassTooltip(button));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
