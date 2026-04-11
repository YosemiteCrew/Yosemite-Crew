import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import InvoiceInfo from '@/app/features/finance/pages/Finance/Sections/InvoiceInfo';

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Accordion/EditableAccordion', () => ({
  __esModule: true,
  default: ({ title, data }: any) => (
    <div>
      <div>{title}</div>
      {data?.paymentMethod ? <div>{data.paymentMethod}</div> : null}
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text }: any) => <div>{text}</div>,
  Secondary: ({ text }: any) => <div>{text}</div>,
}));

jest.mock('@/app/lib/invoicePaymentMethod', () => ({
  getInvoicePaymentMethodLabel: () => 'Paid in cash',
}));

describe('InvoiceInfo', () => {
  it('renders modal and closes', () => {
    const setShowModal = jest.fn();
    render(
      <InvoiceInfo showModal setShowModal={setShowModal} activeInvoice={{ metadata: {} } as any} />
    );

    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByText('View invoice')).toBeInTheDocument();
    expect(screen.getByText('Paid in cash')).toBeInTheDocument();
    expect(screen.queryByText('Generate link')).not.toBeInTheDocument();

    const closeButtons = screen.getAllByText('close');
    fireEvent.click(closeButtons.at(-1)!);
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
