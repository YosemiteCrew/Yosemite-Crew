import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';

describe('GlassTooltip', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
  });

  it('shows and hides tooltip on hover', async () => {
    render(
      <GlassTooltip content="Hello tooltip">
        <button type="button">Trigger</button>
      </GlassTooltip>
    );

    const trigger = screen.getByText('Trigger').closest('span') as HTMLElement;
    Object.defineProperty(trigger, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top: 100, left: 100, right: 160, bottom: 140, width: 60, height: 40 }),
    });

    fireEvent.mouseEnter(trigger);

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    fireEvent.mouseLeave(trigger);
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('applies side-specific transform style', async () => {
    render(
      <GlassTooltip content="Right side" side="right">
        <button type="button">Open</button>
      </GlassTooltip>
    );

    const trigger = screen.getByText('Open').closest('span') as HTMLElement;
    Object.defineProperty(trigger, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top: 200, left: 200, right: 260, bottom: 240, width: 60, height: 40 }),
    });

    fireEvent.mouseEnter(trigger);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveStyle({ transform: 'translate(0, -50%)' });
  });
});
