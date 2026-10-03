import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import IdexxOrderLaunchDialog from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/IdexxOrderLaunchDialog';

const SAFE_URL = 'https://integration.vetconnectplus.com/order/123';

const renderDialog = (props: Partial<React.ComponentProps<typeof IdexxOrderLaunchDialog>> = {}) => {
  const onClose = jest.fn();
  render(
    <IdexxOrderLaunchDialog open url={SAFE_URL} source="order" onClose={onClose} {...props} />
  );
  return { onClose };
};

describe('IdexxOrderLaunchDialog', () => {
  it('offers a link that opens the validated IDEXX URL in a new tab', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: 'IDEXX ordering' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/IDEXX opens in a new browser tab/i)).toBeInTheDocument();
    expect(screen.queryByText(/select Done to refresh/i)).not.toBeInTheDocument();

    const link = screen.getByRole('link', { name: 'Open IDEXX' });
    expect(link).toHaveAttribute('href', SAFE_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('names the follow-up flow and explains how to refresh manually', () => {
    renderDialog({ source: 'followup' });

    expect(screen.getByRole('dialog', { name: 'IDEXX follow-up ordering' })).toBeInTheDocument();
    expect(
      screen.getByText(/If IDEXX shows the order was submitted and this dialog stays open/i)
    ).toBeInTheDocument();
  });

  it('calls onClose from Done, the header close button and Escape', () => {
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('renders nothing while closed', () => {
    renderDialog({ open: false });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open IDEXX' })).not.toBeInTheDocument();
  });

  it.each([
    ['an empty URL', ''],
    ['a missing URL', null],
    ['a non-https URL', 'http://integration.vetconnectplus.com/order/123'],
    ['a host outside IDEXX', 'https://evil.example.com/order/123'],
    ['a lookalike host', 'https://vetconnectplus.com.evil.example/order'],
    ['a script URL', 'javascript:alert(1)'],
  ])('renders no link for %s', (_label, url) => {
    renderDialog({ url });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open IDEXX' })).not.toBeInTheDocument();
  });
});
