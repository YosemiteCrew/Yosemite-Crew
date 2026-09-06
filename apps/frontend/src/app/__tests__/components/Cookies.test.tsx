import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Cookies from '@/app/ui/widgets/Cookies/Cookies';

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: { text: string; onClick: () => void }) => (
    <button onClick={onClick}>{text}</button>
  ),
  Secondary: ({ text, onClick }: { text: string; onClick: () => void }) => (
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
      screen.getByText(/Yosemite Crew uses one consent cookie and optional product analytics/)
    ).toBeInTheDocument();
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

    const popupText = screen.getByText(
      /Yosemite Crew uses one consent cookie and optional product analytics/
    );
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

    const popupText = screen.getByText(
      /Yosemite Crew uses one consent cookie and optional product analytics/
    );
    expect(popupText).toBeInTheDocument();

    const declineButton = screen.getByRole('button', { name: /Reject/ });
    fireEvent.click(declineButton);

    await waitFor(() => {
      expect(popupText).not.toBeInTheDocument();
    });

    expect(setItemSpy).toHaveBeenCalledWith('cookieConsentGiven', 'false');
    expect(localStorage.getItem('cookieConsentGiven')).toBe('false');

    setItemSpy.mockRestore();
  });

  /**
   * The card is `position: fixed` and opaque, so on a phone it lands on
   * whatever is centred underneath it - at 390x844 that measured as 0% of the
   * sign-in submit button being tappable. It publishes the strip it denies so
   * a shell pinned to 100svh can reserve it; these tests are about the value
   * it publishes, not about the class list that positions it.
   */
  describe('the viewport strip it reserves', () => {
    const PHONE_QUERY = '(max-width: 767px)';

    const mockViewport = ({
      isPhone,
      innerHeight,
      cardTop,
      cardHeight,
    }: {
      isPhone: boolean;
      innerHeight: number;
      cardTop: number;
      /**
       * Deliberately NOT `innerHeight - cardTop`. The card is docked 84px above
       * the bottom, so the strip it denies is taller than the card itself - and
       * a fixture where the two are equal cannot tell a correct reservation
       * from one that reserves only the card.
       */
      cardHeight: number;
    }) => {
      (globalThis.matchMedia as jest.Mock).mockImplementation((query: string) => ({
        matches: query === PHONE_QUERY ? isPhone : false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));
      Object.defineProperty(globalThis, 'innerHeight', {
        writable: true,
        configurable: true,
        value: innerHeight,
      });
      return jest
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockReturnValue({
          top: cardTop,
          bottom: cardTop + cardHeight,
          height: cardHeight,
        } as DOMRect);
    };

    const inset = () => document.documentElement.style.getPropertyValue('--yc-consent-inset');

    afterEach(() => {
      jest.restoreAllMocks();
      document.documentElement.style.removeProperty('--yc-consent-inset');
    });

    it('reserves everything from the card top to the bottom of a phone viewport', () => {
      const rect = mockViewport({ isPhone: true, innerHeight: 844, cardTop: 508, cardHeight: 252 });

      render(<Cookies />);

      // 844 - 508 = 336, and the card itself is only 252 tall. The extra 84 is
      // the tab-bar reserve the card is docked above, which is not somewhere
      // content can go either.
      expect(inset()).toBe('336px');
      rect.mockRestore();
    });

    it('reserves nothing on desktop, where the card is placed clear of the page', () => {
      const rect = mockViewport({
        isPhone: false,
        innerHeight: 900,
        cardTop: 494,
        cardHeight: 276,
      });

      render(<Cookies />);

      expect(inset()).toBe('');
      rect.mockRestore();
    });

    it('gives the strip back once a choice has been made', async () => {
      const rect = mockViewport({ isPhone: true, innerHeight: 844, cardTop: 508, cardHeight: 252 });

      render(<Cookies />);
      expect(inset()).toBe('336px');

      fireEvent.click(screen.getByRole('button', { name: /Accept/ }));

      await waitFor(() => {
        expect(inset()).toBe('');
      });
      rect.mockRestore();
    });

    it('gives the strip back when it unmounts with the choice still open', () => {
      const rect = mockViewport({ isPhone: true, innerHeight: 844, cardTop: 508, cardHeight: 252 });

      const { unmount } = render(<Cookies />);
      expect(inset()).toBe('336px');

      unmount();

      expect(inset()).toBe('');
      rect.mockRestore();
    });
  });
});
