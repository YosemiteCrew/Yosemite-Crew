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

  it('does not open on click when openOnClick is unset', async () => {
    render(
      <GlassTooltip content="Hello tooltip">
        <button type="button">Trigger</button>
      </GlassTooltip>
    );

    const trigger = screen.getByText('Trigger').closest('span') as HTMLElement;
    fireEvent.click(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('opens on tap and stays open on a second tap, closing only outside the trigger', async () => {
    render(
      <div>
        <GlassTooltip content="Full value" openOnClick>
          <button type="button">Info</button>
        </GlassTooltip>
        <button type="button">Elsewhere</button>
      </div>
    );

    const trigger = screen.getByText('Info').closest('span') as HTMLElement;
    Object.defineProperty(trigger, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top: 100, left: 100, right: 160, bottom: 140, width: 60, height: 40 }),
    });

    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent('Full value');
    });

    // A no-op mouse leave never touched this path (openOnClick has no hover
    // listener of its own), and a second tap must not toggle it back closed.
    fireEvent.click(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText('Elsewhere'));
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
