import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RowActionMenu, { RowMenuAction } from '@/app/ui/tables/RowActionMenu';

const actions = (): RowMenuAction[] => [
  { key: 'view', label: 'View', icon: <span />, onSelect: jest.fn() },
  { key: 'edit', label: 'Edit', icon: <span />, onSelect: jest.fn() },
  { key: 'delete', label: 'Delete', icon: <span />, onSelect: jest.fn(), dividerBefore: true },
];

const mockButtonRect = (rect: Partial<DOMRect>) => {
  jest.spyOn(HTMLButtonElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    ...rect,
  } as DOMRect);
};

const mockPanelHeight = (height: number) => {
  jest.spyOn(HTMLDivElement.prototype, 'offsetHeight', 'get').mockReturnValue(height);
};

describe('RowActionMenu', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens the menu, lists every action, and closes after selecting one', () => {
    const items = actions();
    render(<RowActionMenu actions={items} label="Row actions" />);

    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('View')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Edit'));
    expect(items[1].onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('notifies onOpenChange as the menu opens and closes', () => {
    const onOpenChange = jest.fn();
    render(<RowActionMenu actions={actions()} label="Row actions" onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    fireEvent.mouseDown(document.body);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('keeps the menu below the trigger when there is room in the viewport', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
    mockButtonRect({ top: 100, bottom: 120, right: 300 });
    mockPanelHeight(200);

    render(<RowActionMenu actions={actions()} label="Row actions" />);
    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));

    const panel = screen.getByRole('menu');
    expect(panel.style.top).toBe('126px'); // rect.bottom + 6
  });

  it('flips the menu above the trigger when a row near the bottom would clip it (bug #1979)', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 400 });
    mockButtonRect({ top: 350, bottom: 380, right: 300 });
    mockPanelHeight(200);

    render(<RowActionMenu actions={actions()} label="Row actions" />);
    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));

    const panel = screen.getByRole('menu');
    // rect.top - panelHeight - 6 = 350 - 200 - 6
    expect(panel.style.top).toBe('144px');
  });

  it('positions on the side with more room and clamps height when neither side fully fits', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 400 });
    // Below has 12px free, above has 42px free - neither fits a 200px panel,
    // but above has more room, so it should flip there and clamp+scroll
    // rather than run off the bottom of the viewport (bug #1979 follow-up).
    mockButtonRect({ top: 50, bottom: 380, right: 300 });
    mockPanelHeight(200);

    render(<RowActionMenu actions={actions()} label="Row actions" />);
    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));

    const panel = screen.getByRole('menu');
    expect(panel.style.top).toBe('8px');
    expect(panel.style.maxHeight).toBe('80px');
    expect(panel.style.overflowY).toBe('auto');
  });

  it('focuses the first action when the menu opens', async () => {
    render(<RowActionMenu actions={actions()} label="Row actions" />);
    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));

    await waitFor(() => {
      expect(screen.getByText('View').closest('button')).toHaveFocus();
    });
  });

  it('closes and returns focus to the trigger on Escape', () => {
    render(<RowActionMenu actions={actions()} label="Row actions" />);
    const trigger = screen.getByRole('button', { name: 'Row actions' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on Tab instead of trapping focus - this is a non-modal menu', () => {
    render(<RowActionMenu actions={actions()} label="Row actions" />);
    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // fireEvent wraps dispatch in act(), unlike a raw document.dispatchEvent,
    // so the resulting setOpen(false) is flushed before the assertion below.
    // Its return value mirrors dispatchEvent's: false only if a cancelable
    // event's default was prevented - so `true` here doubles as proof Tab's
    // default wasn't prevented and the browser's normal focus order continues.
    const notPrevented = fireEvent.keyDown(document, {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(notPrevented).toBe(true);
  });

  it('closes on Shift+Tab too', () => {
    render(<RowActionMenu actions={actions()} label="Row actions" />);
    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('leaves the menu unpositioned when the trigger has no measurable rect', () => {
    jest
      .spyOn(HTMLButtonElement.prototype, 'getBoundingClientRect')
      .mockReturnValue(undefined as unknown as DOMRect);

    render(<RowActionMenu actions={actions()} label="Row actions" />);
    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
