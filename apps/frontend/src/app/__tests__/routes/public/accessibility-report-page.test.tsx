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

jest.mock('@/app/ui/widgets/Footer/Footer', () => {
  return {
    __esModule: true,
    default: function MockFooter() {
      return <footer data-testid="footer" />;
    },
  };
});

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

  it('has no axe violations on initial render', async () => {
    const { container } = render(<AccessibilityReportPage />);
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
        type: 'COMPLAINT',
        source: 'accessibility',
        fullName: 'Ada Lovelace',
        email: 'ada@example.com',
      })
    );

    const callArgs = postDataMock.mock.calls[0][1];
    expect(callArgs.message).toContain('https://app.example.com/appointments');
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

  it('severity select includes all four options', () => {
    render(<AccessibilityReportPage />);
    const select = screen.getByLabelText(/How severe/i) as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual(['blocker', 'major', 'minor', 'unknown']);
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
