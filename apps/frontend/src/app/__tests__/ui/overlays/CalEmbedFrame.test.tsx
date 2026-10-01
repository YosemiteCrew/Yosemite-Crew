import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { getCalApi } from '@calcom/embed-react';
import CalEmbedFrame from '@/app/ui/overlays/CalEmbedFrame';
import { getCalEmbedUrl } from '@/app/ui/overlays/calEmbedUtils';

jest.mock('@calcom/embed-react', () => ({
  __esModule: true,
  getCalApi: jest.fn(),
}));

const mockedGetCalApi = getCalApi as unknown as jest.Mock;

describe('CalEmbedFrame', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds Cal embed URLs with month view parameters', () => {
    expect(getCalEmbedUrl('yosemitecrew/onboarding')).toBe(
      'https://app.cal.com/yosemitecrew/onboarding/embed?theme=light&layout=month_view&embedType=inline&embed=30min'
    );
  });

  it('mounts a Cal inline embed into the full-size container', async () => {
    const cal = jest.fn();
    mockedGetCalApi.mockResolvedValue(cal);

    render(<CalEmbedFrame calLink="yosemitecrew/demo" title="Book a demo" />);

    const frame = screen.getByLabelText('Book a demo');

    await waitFor(() => {
      expect(mockedGetCalApi).toHaveBeenCalledWith({ namespace: '30min' });
    });

    expect(frame).toHaveAttribute('data-cal-embed-frame', 'true');
    expect(frame).toHaveAttribute('data-cal-embed-src', getCalEmbedUrl('yosemitecrew/demo'));
    expect(frame).toHaveClass('flex-1', 'w-full', 'border-0');
    expect(cal).toHaveBeenCalledWith('ui', {
      hideEventTypeDetails: false,
      layout: 'month_view',
    });
    expect(cal).toHaveBeenCalledWith('inline', {
      elementOrSelector: frame,
      calLink: 'yosemitecrew/demo',
      config: { theme: 'light', layout: 'month_view' },
    });
  });

  it('does not mount after unmounting before the Cal API resolves', async () => {
    let resolveCalApi: (cal: jest.Mock) => void = () => undefined;
    const calApiPromise = new Promise<jest.Mock>((resolve) => {
      resolveCalApi = resolve;
    });
    const cal = jest.fn();
    mockedGetCalApi.mockReturnValue(calApiPromise);

    const { unmount } = render(<CalEmbedFrame calLink="yosemitecrew/demo" title="Book a demo" />);
    unmount();
    resolveCalApi(cal);

    await waitFor(() => {
      expect(mockedGetCalApi).toHaveBeenCalledWith({ namespace: '30min' });
    });
    expect(cal).not.toHaveBeenCalled();
  });

  it('shows an accessible error when the Cal API fails to load', async () => {
    mockedGetCalApi.mockRejectedValue(new Error('unavailable'));

    render(<CalEmbedFrame calLink="yosemitecrew/demo" title="Book a demo" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The calendar could not be loaded. Please try again later.'
    );
  });

  it('cleans up a mounted Cal embed on unmount', async () => {
    const cal = jest.fn((action: string, payload?: { elementOrSelector?: HTMLElement }) => {
      if (action === 'inline' && payload?.elementOrSelector) {
        payload.elementOrSelector.appendChild(document.createElement('iframe'));
      }
    });
    mockedGetCalApi.mockResolvedValue(cal);

    const { unmount } = render(<CalEmbedFrame calLink="yosemitecrew/demo" title="Book a demo" />);
    const frame = screen.getByLabelText('Book a demo');

    await waitFor(() => {
      expect(frame.querySelector('iframe')).toBeInTheDocument();
    });

    unmount();
    expect(frame.querySelector('iframe')).not.toBeInTheDocument();
  });
});
