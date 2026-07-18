import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BottomSheet from '@/app/ui/layout/PhoneShell/BottomSheet';

const renderSheet = (props: Partial<React.ComponentProps<typeof BottomSheet>> = {}) => {
  const onClose = jest.fn();
  const utils = render(
    <BottomSheet open title="More" onClose={onClose} {...props}>
      <button type="button">Child A</button>
      <button type="button">Child B</button>
    </BottomSheet>
  );
  const panel = utils.container.querySelector('.yc-phone-sheet') as HTMLElement;
  const closeBtn = utils.container.querySelector('.yc-phone-sheet-close') as HTMLElement;
  const backdrop = utils.container.querySelector('.yc-phone-sheet-backdrop') as HTMLElement;
  const childB = screen.getByText('Child B');
  const childA = screen.getByText('Child A');
  return { ...utils, onClose, panel, closeBtn, backdrop, childA, childB };
};

describe('BottomSheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <BottomSheet open={false} title="More" onClose={jest.fn()}>
        <span>hidden</span>
      </BottomSheet>
    );
    expect(container.querySelector('.yc-phone-sheet')).not.toBeInTheDocument();
    expect(screen.queryByText('hidden')).not.toBeInTheDocument();
  });

  it('renders the dialog with grabber, title, close button and content when open', () => {
    const { container } = renderSheet();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(container.querySelector('.yc-phone-sheet-grabber')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'More' })).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(screen.getByText('Child A')).toBeInTheDocument();
  });

  it('focuses the first focusable element (the close button) on open', () => {
    const { closeBtn } = renderSheet();
    expect(document.activeElement).toBe(closeBtn);
  });

  it('renders a footer region only when a footer is provided', () => {
    const withFooter = render(
      <BottomSheet
        open
        title="More"
        onClose={jest.fn()}
        footer={<button type="button">Done</button>}
      >
        <span>body</span>
      </BottomSheet>
    );
    expect(withFooter.container.querySelector('.yc-phone-sheet-footer')).toBeInTheDocument();
    withFooter.unmount();

    const { container } = renderSheet();
    expect(container.querySelector('.yc-phone-sheet-footer')).not.toBeInTheDocument();
  });

  it('applies an extra panel class name when provided', () => {
    const { panel } = renderSheet({ className: 'yc-custom-sheet' });
    expect(panel).toHaveClass('yc-custom-sheet');
  });

  it('closes when the backdrop is clicked', () => {
    const { backdrop, onClose } = renderSheet();
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the close button is clicked', () => {
    const { closeBtn, onClose } = renderSheet();
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape but ignores other keys', () => {
    const { onClose } = renderSheet();
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps Tab forward from the last element back to the first', () => {
    const { childB, closeBtn } = renderSheet();
    childB.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(closeBtn);
  });

  it('traps Shift+Tab from the first element to the last', () => {
    const { closeBtn, childB } = renderSheet();
    closeBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(childB);
  });

  it('leaves focus untouched when Tab is pressed in the middle', () => {
    const { childA } = renderSheet();
    childA.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(childA);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(childA);
  });

  it('restores focus to the previously focused element after unmount', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = renderSheet();
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
