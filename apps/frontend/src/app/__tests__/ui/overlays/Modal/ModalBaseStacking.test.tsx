/**
 * A modal opened from inside another modal must not take its parent down with
 * it. Each ModalBase installs document-level Escape and outside-mousedown
 * listeners and shares one body scroll lock, so before this was stack-aware a
 * nested confirmation dismissed the editor underneath it and released the
 * parent's scroll lock on close.
 */
import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';

/** Parent modal that can open a nested child, mirroring the real flows. */
const Nested = () => {
  const [parentOpen, setParentOpen] = useState(true);
  const [childOpen, setChildOpen] = useState(false);
  return (
    <div>
      <CenterModal showModal={parentOpen} setShowModal={setParentOpen} ariaLabel="Parent editor">
        <p>parent body</p>
        <button type="button" onClick={() => setChildOpen(true)}>
          open child
        </button>
      </CenterModal>
      <CenterModal showModal={childOpen} setShowModal={setChildOpen} ariaLabel="Child confirmation">
        <p>child body</p>
      </CenterModal>
      <span data-testid="state">{`${parentOpen ? 'parent-open' : 'parent-closed'} ${childOpen ? 'child-open' : 'child-closed'}`}</span>
    </div>
  );
};

const state = () => screen.getByTestId('state').textContent;

describe('nested modals', () => {
  afterEach(() => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.body.style.paddingRight = '';
  });

  it('closes only the topmost modal on Escape', () => {
    render(<Nested />);
    fireEvent.click(screen.getByText('open child'));
    expect(state()).toBe('parent-open child-open');

    fireEvent.keyDown(document, { key: 'Escape' });

    // The child goes; the parent and any unsaved state in it survive.
    expect(state()).toBe('parent-open child-closed');
  });

  it('closes only the topmost modal on an outside mousedown', () => {
    render(<Nested />);
    fireEvent.click(screen.getByText('open child'));
    expect(state()).toBe('parent-open child-open');

    // A click on the child's backdrop sits outside .yc-modal-dialog, which is
    // exactly the case that used to dismiss both.
    fireEvent.mouseDown(document.body);

    expect(state()).toBe('parent-open child-closed');
  });

  it('keeps the parent scroll lock when the child closes', () => {
    render(<Nested />);
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.click(screen.getByText('open child'));
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });

    // The parent is still open, so the page behind it must stay locked.
    expect(state()).toBe('parent-open child-closed');
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('releases the scroll lock once the last modal closes', () => {
    render(<Nested />);
    fireEvent.click(screen.getByText('open child'));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(state()).toBe('parent-closed child-closed');
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('restores focus to the opener when a modal unmounts while open', () => {
    const Unmounting = () => {
      const [mounted, setMounted] = useState(false);
      return (
        <div>
          <button type="button" data-testid="opener" onClick={() => setMounted(true)}>
            open
          </button>
          {mounted && (
            <CenterModal showModal setShowModal={() => setMounted(false)} ariaLabel="Transient">
              <button type="button" onClick={() => setMounted(false)}>
                resolve
              </button>
            </CenterModal>
          )}
        </div>
      );
    };
    render(<Unmounting />);
    const opener = screen.getByTestId('opener');
    opener.focus();
    fireEvent.click(opener);

    // Resolving unmounts the modal outright rather than rerendering it closed,
    // which is how the promise-based confirmation settles.
    fireEvent.click(screen.getByText('resolve'));

    expect(document.activeElement).toBe(opener);
  });
});
