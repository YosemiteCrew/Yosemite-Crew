import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Cookies from '@/app/components/Cookies/Cookies';

jest.mock('@/app/pages/HomePage/HomePage', () => ({
  FillBtn: ({ text, onClick }: { text: string; onClick: () => void }) => (
    <button onClick={onClick}>{text}</button>
  ),
  UnFillBtn: ({ text, onClick }: { text: string; onClick: () => void }) => (
    <button onClick={onClick}>{text}</button>
  ),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    return <img {...props} alt={props.alt} />;
  },
}));

jest.mock('react-icons/io', () => ({
  IoIosCloseCircle: () => <span data-testid="close-icon" />,
  IoIosCheckmarkCircle: () => <span data-testid="checkmark-icon" />,
}));


describe('Cookies Component', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('should display the cookie popup if consent has not been given', () => {
    render(<Cookies />);

    expect(
      screen.getByText(/Yosemite Crew doesn't use third party cookies/)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Accept/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Decline/ })).toBeInTheDocument();
  });

  it('should not display the cookie popup if consent was already given', () => {
    localStorage.setItem('cookieConsentGiven', 'true');

    const { container } = render(<Cookies />);

    expect(container).toBeEmptyDOMElement();
  });

  it('should not display the cookie popup if cookies were already rejected', () => {
    localStorage.setItem('cookieConsentGiven', 'false');

    const { container } = render(<Cookies />);

    expect(container).toBeEmptyDOMElement();
  });

  it('should hide the popup and set localStorage when the "Accept" button is clicked', async () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

    render(<Cookies />);

    const popupText = screen.getByText(/Yosemite Crew doesn't use third party cookies/);
    expect(popupText).toBeInTheDocument();

    const acceptButton = screen.getByRole('button', { name: /Accept/ });
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(popupText).not.toBeInTheDocument();
    });

    expect(setItemSpy).toHaveBeenCalledWith('cookieConsentGiven', 'true');
    expect(localStorage.getItem('cookieConsentGiven')).toBe('true');

    setItemSpy.mockRestore();
  });

  it('should hide the popup and set localStorage when the "Decline" button is clicked', async () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

    render(<Cookies />);

    const popupText = screen.getByText(/Yosemite Crew doesn't use third party cookies/);
    expect(popupText).toBeInTheDocument();

    const declineButton = screen.getByRole('button', { name: /Decline/ });
    fireEvent.click(declineButton);

    await waitFor(() => {
      expect(popupText).not.toBeInTheDocument();
    });

    expect(setItemSpy).toHaveBeenCalledWith('cookieConsentGiven', 'false');
    expect(localStorage.getItem('cookieConsentGiven')).toBe('false');

    setItemSpy.mockRestore();
  });
});