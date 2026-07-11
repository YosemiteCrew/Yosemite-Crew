import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import GuidePlayerModal, {
  buildGuideDeepLink,
} from '@/app/ui/overlays/Modal/GuidePlayerModal';
import { GuideVideo } from '@/app/features/guides/types/guides';

jest.mock('@/app/ui/overlays/Modal/ModalBase', () => ({
  __esModule: true,
  default: ({ children, showModal, setShowModal, onClose }: any) => {
    if (!showModal) return null;
    const close = () => {
      setShowModal(false);
      onClose?.();
    };
    return (
      <div data-testid="modal-base">
        <button type="button" data-testid="backdrop" onClick={close}>
          backdrop
        </button>
        <button type="button" data-testid="escape" onClick={close}>
          escape
        </button>
        {children}
      </div>
    );
  },
}));

const guide: GuideVideo = {
  id: 'run-a-visit',
  title: 'Run a visit end to end',
  description: 'SOAP, diagnostics, treatment and collecting payment in one flow.',
  duration: '5:18',
  category: 'Appointments',
  tags: [],
  videoUrl: 'video.mp4',
  thumbnailUrl: 'thumb.png',
  progressPercent: 60,
  currentTime: '3:07',
  chapters: [
    { label: 'check-in', time: '0:00' },
    { label: 'invoice & payment', time: '4:12', highlight: true },
  ],
};

const nextGuide: GuideVideo = {
  ...guide,
  id: 'invoices-payouts',
  title: 'Invoices, deposits and payouts',
  chapters: undefined,
  progressPercent: undefined,
  currentTime: undefined,
};

const setClipboard = (impl?: jest.Mock) => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: impl ? { writeText: impl } : undefined,
  });
};

describe('GuidePlayerModal', () => {
  afterEach(() => {
    setClipboard(undefined);
  });

  it('renders nothing when there is no guide', () => {
    const { container } = render(
      <GuidePlayerModal
        showModal
        setShowModal={jest.fn()}
        guide={null}
        nextGuide={null}
        onNext={jest.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders header, time, chapters and next-guide link', () => {
    render(
      <GuidePlayerModal
        showModal
        setShowModal={jest.fn()}
        guide={guide}
        nextGuide={nextGuide}
        onNext={jest.fn()}
      />
    );
    expect(screen.getByText('Appointments')).toBeInTheDocument();
    expect(screen.getByText('Run a visit end to end')).toBeInTheDocument();
    expect(screen.getByText('3:07 / 5:18')).toBeInTheDocument();
    expect(screen.getByText(/invoice & payment 4:12/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Next: Invoices, deposits and payouts/ })
    ).toBeInTheDocument();
  });

  it('calls onNext when the next link is clicked', () => {
    const onNext = jest.fn();
    render(
      <GuidePlayerModal
        showModal
        setShowModal={jest.fn()}
        guide={guide}
        nextGuide={nextGuide}
        onNext={onNext}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Next:/ }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('closes via the close button, backdrop and escape', () => {
    const setShowModal = jest.fn();
    render(
      <GuidePlayerModal
        showModal
        setShowModal={setShowModal}
        guide={guide}
        nextGuide={null}
        onNext={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByTestId('backdrop'));
    fireEvent.click(screen.getByTestId('escape'));
    expect(setShowModal).toHaveBeenCalledWith(false);
    expect(setShowModal).toHaveBeenCalledTimes(3);
  });

  it('copies the deep link and shows feedback that auto-resets', async () => {
    jest.useFakeTimers();
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    render(
      <GuidePlayerModal
        showModal
        setShowModal={jest.fn()}
        guide={guide}
        nextGuide={null}
        onNext={jest.fn()}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy link/ }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith('http://localhost/guides?guide=run-a-visit');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(1800);
    });
    expect(screen.getByRole('button', { name: /Copy link/ })).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('stays put when the clipboard API is unavailable', async () => {
    setClipboard(undefined);
    render(
      <GuidePlayerModal
        showModal
        setShowModal={jest.fn()}
        guide={guide}
        nextGuide={null}
        onNext={jest.fn()}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy link/ }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByRole('button', { name: 'Copied' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy link/ })).toBeInTheDocument();
  });

  it('degrades when the clipboard write rejects', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('denied'));
    setClipboard(writeText);
    render(
      <GuidePlayerModal
        showModal
        setShowModal={jest.fn()}
        guide={guide}
        nextGuide={null}
        onNext={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Copy link/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Copied' })).not.toBeInTheDocument();
  });

  it('renders a guide without chapters or progress at 0:00', () => {
    render(
      <GuidePlayerModal
        showModal
        setShowModal={jest.fn()}
        guide={nextGuide}
        nextGuide={null}
        onNext={jest.fn()}
      />
    );
    expect(screen.getByText('0:00 / 5:18')).toBeInTheDocument();
    expect(screen.queryByText(/Chapters:/)).not.toBeInTheDocument();
  });

  it('evaluates the closed (opacity-0) container state', () => {
    render(
      <GuidePlayerModal
        showModal={false}
        setShowModal={jest.fn()}
        guide={guide}
        nextGuide={null}
        onNext={jest.fn()}
      />
    );
    // The overlay/container class ternaries still evaluate their hidden branch
    // during render; the mocked ModalBase renders null while closed.
    expect(screen.queryByText(guide.title)).not.toBeInTheDocument();
  });

  describe('buildGuideDeepLink', () => {
    it('uses the window origin when present', () => {
      expect(buildGuideDeepLink('abc')).toBe('http://localhost/guides?guide=abc');
    });
    // The SSR / empty-origin fallback is not reproducible under jsdom
    // (window.location.origin is always defined and cannot be redefined), so
    // the `: ''` branch in buildGuideDeepLink carries a v8 ignore in source.
  });
});
