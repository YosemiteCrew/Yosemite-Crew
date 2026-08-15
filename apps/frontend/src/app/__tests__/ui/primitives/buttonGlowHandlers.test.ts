import type { PointerEvent } from 'react';
import { primaryButtonGlowHandlers } from '@/app/ui/primitives/buttonGlowHandlers';

const buildPointerEvent = () => {
  const setProperty = jest.fn();
  const event = {
    clientX: 110,
    clientY: 220,
    currentTarget: {
      getBoundingClientRect: () => ({ left: 10, top: 20 }),
      style: { setProperty },
    },
  } as unknown as PointerEvent<HTMLButtonElement>;
  return { event, setProperty };
};

describe('primaryButtonGlowHandlers', () => {
  it('onPointerDown positions the glow relative to the button', () => {
    const { event, setProperty } = buildPointerEvent();
    primaryButtonGlowHandlers.onPointerDown(event);
    expect(setProperty).toHaveBeenCalledWith('--yc-button-x', '100px');
    expect(setProperty).toHaveBeenCalledWith('--yc-button-y', '200px');
  });

  it('onPointerMove tracks the cursor with the same handler behaviour', () => {
    const { event, setProperty } = buildPointerEvent();
    primaryButtonGlowHandlers.onPointerMove(event);
    expect(setProperty).toHaveBeenCalledTimes(2);
    expect(setProperty).toHaveBeenNthCalledWith(1, '--yc-button-x', '100px');
    expect(setProperty).toHaveBeenNthCalledWith(2, '--yc-button-y', '200px');
  });
});
