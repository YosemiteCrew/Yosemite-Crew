import React from 'react';
import { render, screen } from '@testing-library/react';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';

jest.mock('@/app/ui/overlays/Modal/ModalBase', () => ({
  __esModule: true,
  default: ({ children, overlayClassName, containerClassName, ignoreOutsideClick }: any) => (
    <div
      data-testid="modal-base"
      data-overlay-class={overlayClassName}
      data-container-class={containerClassName}
    >
      <button
        type="button"
        data-testid="check-ignore-inside"
        onClick={() => {
          const el = document.createElement('div');
          el.setAttribute('data-portal-dropdown', '');
          (globalThis as any).__ignoreResult = ignoreOutsideClick(el);
        }}
      />
      <button
        type="button"
        data-testid="check-ignore-outside"
        onClick={() => {
          const el = document.createElement('div');
          (globalThis as any).__ignoreResult = ignoreOutsideClick(el);
        }}
      />
      <button
        type="button"
        data-testid="check-ignore-null"
        onClick={() => {
          (globalThis as any).__ignoreResult = ignoreOutsideClick(null);
        }}
      />
      {children}
    </div>
  ),
}));

describe('CenterModal', () => {
  it('renders children through ModalBase', () => {
    render(
      <CenterModal showModal setShowModal={jest.fn()}>
        <span>Modal body</span>
      </CenterModal>
    );
    expect(screen.getByText('Modal body')).toBeInTheDocument();
  });

  it('applies open opacity classes when showModal is true', () => {
    render(
      <CenterModal showModal setShowModal={jest.fn()}>
        <span>Body</span>
      </CenterModal>
    );
    const modal = screen.getByTestId('modal-base');
    expect(modal.dataset.overlayClass).toContain('opacity-100');
    expect(modal.dataset.containerClass).toContain('opacity-100');
  });

  it('applies closed opacity classes when showModal is false', () => {
    render(
      <CenterModal showModal={false} setShowModal={jest.fn()}>
        <span>Body</span>
      </CenterModal>
    );
    const modal = screen.getByTestId('modal-base');
    expect(modal.dataset.overlayClass).toContain('opacity-0');
    expect(modal.dataset.containerClass).toContain('opacity-0');
  });

  it('merges a custom containerClassName', () => {
    render(
      <CenterModal showModal setShowModal={jest.fn()} containerClassName="custom-class">
        <span>Body</span>
      </CenterModal>
    );
    expect(screen.getByTestId('modal-base').dataset.containerClass).toContain('custom-class');
  });

  it('ignores outside clicks that target a portal dropdown', () => {
    render(
      <CenterModal showModal setShowModal={jest.fn()}>
        <span>Body</span>
      </CenterModal>
    );
    screen.getByTestId('check-ignore-inside').click();
    expect((globalThis as any).__ignoreResult).toBe(true);
  });

  it('does not ignore outside clicks outside a portal dropdown', () => {
    render(
      <CenterModal showModal setShowModal={jest.fn()}>
        <span>Body</span>
      </CenterModal>
    );
    screen.getByTestId('check-ignore-outside').click();
    expect((globalThis as any).__ignoreResult).toBe(false);
  });

  it('treats a null target as not-ignored', () => {
    render(
      <CenterModal showModal setShowModal={jest.fn()}>
        <span>Body</span>
      </CenterModal>
    );
    screen.getByTestId('check-ignore-null').click();
    expect((globalThis as any).__ignoreResult).toBe(false);
  });
});
