import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useConfirm } from '@/app/ui/overlays/Modal/ConfirmModal';

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons/Delete', () => ({
  __esModule: true,
  default: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children, ariaLabel }: any) =>
    showModal ? (
      <div role="dialog" aria-label={ariaLabel}>
        {children}
      </div>
    ) : null,
}));

jest.mock('@/app/ui/overlays/Modal/ModalHeader', () => ({
  __esModule: true,
  default: ({ title, onClose }: any) => (
    <div>
      <span>{title}</span>
      <button type="button" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/overlays/Modal/ModalFooter', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

/** Mirrors how a real call site uses the hook inside an async handler. */
const Harness = ({ onResult, tone }: { onResult: (v: boolean) => void; tone?: 'danger' }) => {
  const { confirm, confirmDialog } = useConfirm();
  return (
    <div>
      {confirmDialog}
      <button
        type="button"
        onClick={async () => {
          const ok = await confirm({
            title: 'Disconnect IDEXX?',
            body: 'Lab ordering stops until it is enabled again.',
            confirmLabel: 'Disconnect',
            tone,
          });
          onResult(ok);
        }}
      >
        trigger
      </button>
    </div>
  );
};

describe('useConfirm', () => {
  it('renders nothing until confirm is called', () => {
    render(<Harness onResult={jest.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('resolves true when the confirm action is taken', async () => {
    const onResult = jest.fn();
    render(<Harness onResult={onResult} />);

    fireEvent.click(screen.getByText('trigger'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByText('Lab ordering stops until it is enabled again.')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Disconnect'));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
    // The dialog closes once settled.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('resolves false when cancelled', async () => {
    const onResult = jest.fn();
    render(<Harness onResult={onResult} />);

    fireEvent.click(screen.getByText('trigger'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it('resolves false when dismissed via the close control', async () => {
    const onResult = jest.fn();
    render(<Harness onResult={onResult} />);

    fireEvent.click(screen.getByText('trigger'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByText('close'));

    // Dismissing is a decline, matching what the native confirm() did.
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it('gives the dialog an accessible name from the title', async () => {
    render(<Harness onResult={jest.fn()} />);
    fireEvent.click(screen.getByText('trigger'));

    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Disconnect IDEXX?' })).toBeInTheDocument()
    );
  });

  it('can be reopened after settling', async () => {
    const onResult = jest.fn();
    render(<Harness onResult={onResult} />);

    fireEvent.click(screen.getByText('trigger'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fireEvent.click(screen.getByText('trigger'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Disconnect'));

    await waitFor(() => expect(onResult).toHaveBeenNthCalledWith(2, true));
  });
});
