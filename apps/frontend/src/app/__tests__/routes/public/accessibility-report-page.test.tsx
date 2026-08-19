import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

const postDataMock = jest.fn();
const isAxiosErrorMock = jest.fn();

jest.mock('@/app/services/axios', () => ({
  postData: (...args: unknown[]) => postDataMock(...args),
}));

jest.mock('axios', () => ({
  isAxiosError: (err: unknown) => isAxiosErrorMock(err),
}));

jest.mock('next/link', () => {
  return {
    __esModule: true,
    default: function MockLink({
      children,
      href,
      ...rest
    }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }>) {
      return (
        <a href={href} {...rest}>
          {children}
        </a>
      );
    },
  };
});

// The page renders through MarketingShell, whose SiteNav and SiteFooter read
// live GitHub stats. Without this the hook's async cache emit lands after the
// test finishes and the console.error spy turns the act() warning into a
// failure. Same mock the other marketing-surface suites use.
jest.mock('@/app/features/marketing/site/useGithubStats', () => ({
  useGithubStats: () => ({ stars: '2,431' }),
}));

import AccessibilityReportPage from '@/app/(routes)/(public)/accessibility/report/page';

describe('AccessibilityReportPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isAxiosErrorMock.mockReturnValue(false);
  });

  it('renders form with all fields and submit button', () => {
    render(<AccessibilityReportPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: /Report an accessibility barrier/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Your name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Page or URL/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/How severe/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Describe the barrier/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit report' })).toBeInTheDocument();
  });

  it('renders the shared marketing footer, not the legacy app one', async () => {
    // The page shipped with the legacy ui/widgets/Footer while the rest of the
    // public site had moved to SiteFooter, so /accessibility/report showed a
    // different footer from /accessibility. It also sat on the PIMS app surface
    // (data-yc-app) rather than the marketing one.
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<AccessibilityReportPage />));
    });
    expect(container.querySelector('[data-yc-footer]')).toBeInTheDocument();
    expect(container.querySelector('footer.Footersec')).not.toBeInTheDocument();
    expect(container.querySelector('[data-yc-app]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-yc-theme]')).toBeInTheDocument();
    // MarketingShell owns the single main landmark.
    expect(container.querySelectorAll('main#main-content')).toHaveLength(1);
  });

  it('has no axe violations on initial render', async () => {
    // MarketingShell renders SiteNav, which updates state on mount. Rendering
    // inside act() flushes that before axe runs, so the assertion covers the
    // settled page rather than racing its first effect.
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<AccessibilityReportPage />));
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('shows validation errors when submitting empty form', async () => {
    render(<AccessibilityReportPage />);
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Submit report' }).closest('form')!);
    });

    await waitFor(() => {
      expect(
        screen.getByRole('alert', { name: /Please fix the following errors/i })
      ).toBeInTheDocument();
    });

    expect(screen.getAllByText('Your name is required.')).toHaveLength(2);
    expect(screen.getAllByText('Your email address is required.')).toHaveLength(2);
    expect(screen.getAllByText('Please describe the barrier you encountered.')).toHaveLength(2);
    expect(postDataMock).not.toHaveBeenCalled();
  });

  it('shows email format error for invalid email', async () => {
    render(<AccessibilityReportPage />);

    fireEvent.change(screen.getByLabelText(/Your name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'not-an-email' },
    });
    fireEvent.change(screen.getByLabelText(/Describe the barrier/i), { target: { value: 'desc' } });
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Submit report' }).closest('form')!);
    });

    await waitFor(() => {
      expect(screen.getAllByText('Enter a valid email address.')).toHaveLength(2);
    });
    expect(postDataMock).not.toHaveBeenCalled();
  });

  it('clears individual field error when user types into it', async () => {
    render(<AccessibilityReportPage />);
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Submit report' }).closest('form')!);
    });

    await waitFor(() => {
      expect(screen.getAllByText('Your name is required.')).toHaveLength(2);
    });

    fireEvent.change(screen.getByLabelText(/Your name/i), { target: { value: 'Ada' } });
    expect(screen.queryByText('Your name is required.')).not.toBeInTheDocument();
  });

  it('submits form and shows success state', async () => {
    postDataMock.mockResolvedValue({});

    render(<AccessibilityReportPage />);

    fireEvent.change(screen.getByLabelText(/Your name/i), { target: { value: 'Ada Lovelace' } });
    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/Page or URL/i), {
      target: { value: 'https://app.example.com/appointments' },
    });
    fireEvent.click(screen.getByRole('button', { name: /How severe is the impact/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Very difficult to use' }));
    fireEvent.change(screen.getByLabelText(/Describe the barrier/i), {
      target: { value: 'Cannot tab to the submit button.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Thank you for your report/i })
      ).toBeInTheDocument();
    });

    expect(postDataMock).toHaveBeenCalledWith(
      '/v1/contact-us/contact-web',
      expect.objectContaining({
        // ContactSource only accepts MOBILE_APP | PMS_WEB | MARKETING_SITE; any
        // other value is rejected by the backend's enum.
        type: 'COMPLAINT',
        source: 'PMS_WEB',
        fullName: 'Ada Lovelace',
        email: 'ada@example.com',
      })
    );

    const callArgs = postDataMock.mock.calls[0][1];
    expect(callArgs.message).toContain('Accessibility barrier report');
    expect(callArgs.message).toContain('https://app.example.com/appointments');
    expect(callArgs.message).toContain('Severity: Very difficult to use');
    expect(callArgs.message).toContain('Cannot tab to the submit button.');
  });

  it('shows submit error when API call fails', async () => {
    postDataMock.mockRejectedValue(new Error('Network error'));
    isAxiosErrorMock.mockReturnValue(false);

    render(<AccessibilityReportPage />);

    fireEvent.change(screen.getByLabelText(/Your name/i), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/Describe the barrier/i), {
      target: { value: 'Issue description.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));

    await waitFor(() => {
      expect(
        screen.getByRole('alert', { name: /Please fix the following errors/i })
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText('Failed to submit report. Please try emailing us directly.')
    ).toBeInTheDocument();
  });

  it('shows axios error message when API returns error response', async () => {
    const axiosErr = {
      message: 'Bad Request',
      response: { data: { message: 'Email domain blocked' } },
    };
    postDataMock.mockRejectedValue(axiosErr);
    isAxiosErrorMock.mockReturnValue(true);

    render(<AccessibilityReportPage />);

    fireEvent.change(screen.getByLabelText(/Your name/i), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/Describe the barrier/i), {
      target: { value: 'Issue.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));

    await waitFor(() => {
      expect(screen.getByText('Email domain blocked')).toBeInTheDocument();
    });
  });

  it('falls back to axios error message when response message is unavailable', async () => {
    const axiosErr = {
      message: 'Service unavailable',
      response: { data: {} },
    };
    postDataMock.mockRejectedValue(axiosErr);
    isAxiosErrorMock.mockReturnValue(true);

    render(<AccessibilityReportPage />);

    fireEvent.change(screen.getByLabelText(/Your name/i), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/Describe the barrier/i), {
      target: { value: 'Issue.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));

    await waitFor(() => {
      expect(screen.getByText('Service unavailable')).toBeInTheDocument();
    });
  });

  it('success page has no axe violations', async () => {
    postDataMock.mockResolvedValue({});

    const { container } = render(<AccessibilityReportPage />);

    fireEvent.change(screen.getByLabelText(/Your name/i), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/Describe the barrier/i), {
      target: { value: 'Issue.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));

    await screen.findByRole('heading', { name: /Thank you/i });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('severity dropdown includes all four options', () => {
    render(<AccessibilityReportPage />);
    fireEvent.click(screen.getByRole('button', { name: /How severe is the impact/i }));

    expect(
      screen.getByRole('button', { name: 'Cannot use the feature at all' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Very difficult to use' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inconvenient but workable' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not sure' })).toBeInTheDocument();
  });

  it('breadcrumb links back to accessibility statement', () => {
    render(<AccessibilityReportPage />);
    expect(screen.getByRole('link', { name: 'Accessibility Statement' })).toHaveAttribute(
      'href',
      '/accessibility'
    );
  });

  it('cancel link points to accessibility statement', () => {
    render(<AccessibilityReportPage />);
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/accessibility');
  });
});
