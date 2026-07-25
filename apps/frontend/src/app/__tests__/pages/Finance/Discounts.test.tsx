import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

// Renders children so both the page gate and the save gate are exercised; the
// permission logic itself is covered by PermissionGate's own tests.
jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/primitives/GlassTooltip/GlassTooltip', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

jest.mock('react-icons/io5', () => ({
  IoInformationCircleOutline: () => <span data-testid="info-icon" />,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, ariaLabel, onClick, isDisabled }: any) => (
    <button type="button" aria-label={ariaLabel} onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ href, text, ariaLabel, onClick }: any) =>
    href ? (
      <a href={href} aria-label={ariaLabel}>
        {text}
      </a>
    ) : (
      <button type="button" aria-label={ariaLabel} onClick={onClick}>
        {text}
      </button>
    ),
}));

const mockNotify = jest.fn();
jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));

const orgStoreState = { primaryOrgId: 'org-1' as string | null };
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector(orgStoreState),
}));

// Mock the transport, not the hook, so the page's real load/save/error paths run.
const discountSettingsMock = {
  getOrganisationDiscountSettings: jest.fn(),
  updateOrganisationDiscountSettings: jest.fn(),
};
jest.mock('@/app/features/finance/services/discountSettingsService', () => ({
  getOrganisationDiscountSettings: (...args: unknown[]) =>
    discountSettingsMock.getOrganisationDiscountSettings(...args),
  updateOrganisationDiscountSettings: (...args: unknown[]) =>
    discountSettingsMock.updateOrganisationDiscountSettings(...args),
  getDiscountSettingsErrorMessage: (error: unknown, fallback: string) => {
    const body = (error as { response?: { data?: { message?: string } } })?.response?.data;
    if (body?.message) return body.message;
    if (error instanceof Error) return error.message;
    return fallback;
  },
}));

import ProtectedDiscounts, { parseCapInput } from '@/app/features/finance/pages/Discounts';

const capInput = () => screen.getByLabelText('Maximum overall discount percent');
const saveButton = () => screen.getByRole('button', { name: /save discount cap/i });

describe('parseCapInput', () => {
  it('treats an empty value as "no cap"', () => {
    expect(parseCapInput('')).toEqual({ ok: true, value: null });
    expect(parseCapInput('   ')).toEqual({ ok: true, value: null });
  });

  it('accepts 0 and 100 inclusive', () => {
    expect(parseCapInput('0')).toEqual({ ok: true, value: 0 });
    expect(parseCapInput('100')).toEqual({ ok: true, value: 100 });
    expect(parseCapInput('12.5')).toEqual({ ok: true, value: 12.5 });
  });

  it('rejects out-of-range values', () => {
    expect(parseCapInput('101')).toEqual({
      ok: false,
      message: 'The cap must be between 0 and 100 percent.',
    });
    expect(parseCapInput('-1')).toEqual({
      ok: false,
      message: 'The cap must be between 0 and 100 percent.',
    });
  });

  it('rejects a non-numeric value', () => {
    expect(parseCapInput('abc')).toEqual({
      ok: false,
      message: 'Enter a number between 0 and 100, or leave it empty for no cap.',
    });
  });
});

describe('Finance > Discounts page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    orgStoreState.primaryOrgId = 'org-1';
    discountSettingsMock.getOrganisationDiscountSettings.mockResolvedValue({
      organisationId: 'org-1',
      maxOverallDiscountPercent: 20,
    });
    discountSettingsMock.updateOrganisationDiscountSettings.mockImplementation(
      async (_orgId: string, input: { maxOverallDiscountPercent: number | null }) => ({
        organisationId: 'org-1',
        maxOverallDiscountPercent: input.maxOverallDiscountPercent,
      })
    );
  });

  it('renders the configured cap for the primary organisation', async () => {
    render(<ProtectedDiscounts />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Discounts' })).toBeInTheDocument();
    await waitFor(() => expect(capInput()).toHaveValue(20));
    expect(discountSettingsMock.getOrganisationDiscountSettings).toHaveBeenCalledWith('org-1');
    expect(screen.getByText(/currently capped at 20%/i)).toBeInTheDocument();
  });

  it('shows the no-cap state when the organisation has none configured', async () => {
    discountSettingsMock.getOrganisationDiscountSettings.mockResolvedValue({
      organisationId: 'org-1',
      maxOverallDiscountPercent: null,
    });

    render(<ProtectedDiscounts />);

    expect(await screen.findByText(/no cap is configured/i)).toBeInTheDocument();
    expect(capInput()).toHaveValue(null);
  });

  it('saves a new cap and confirms it', async () => {
    render(<ProtectedDiscounts />);
    await waitFor(() => expect(capInput()).toHaveValue(20));

    await userEvent.clear(capInput());
    await userEvent.type(capInput(), '35');
    await userEvent.click(saveButton());

    await waitFor(() =>
      expect(discountSettingsMock.updateOrganisationDiscountSettings).toHaveBeenCalledWith(
        'org-1',
        {
          maxOverallDiscountPercent: 35,
        }
      )
    );
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Discount cap updated' })
    );
    await waitFor(() => expect(screen.getByText(/currently capped at 35%/i)).toBeInTheDocument());
  });

  it('clears the cap when the field is emptied', async () => {
    render(<ProtectedDiscounts />);
    await waitFor(() => expect(capInput()).toHaveValue(20));

    await userEvent.clear(capInput());
    await userEvent.click(saveButton());

    await waitFor(() =>
      expect(discountSettingsMock.updateOrganisationDiscountSettings).toHaveBeenCalledWith(
        'org-1',
        {
          maxOverallDiscountPercent: null,
        }
      )
    );
    expect(await screen.findByText(/no cap is configured/i)).toBeInTheDocument();
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ text: 'The overall invoice discount is no longer capped.' })
    );
  });

  it('rejects an out-of-range cap client-side without calling the API', async () => {
    render(<ProtectedDiscounts />);
    await waitFor(() => expect(capInput()).toHaveValue(20));

    await userEvent.clear(capInput());
    await userEvent.type(capInput(), '150');
    await userEvent.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The cap must be between 0 and 100 percent.'
    );
    expect(discountSettingsMock.updateOrganisationDiscountSettings).not.toHaveBeenCalled();
  });

  it('surfaces an API error from saving through the error surface', async () => {
    discountSettingsMock.updateOrganisationDiscountSettings.mockRejectedValue({
      response: { data: { message: 'Invalid request body' } },
    });

    render(<ProtectedDiscounts />);
    await waitFor(() => expect(capInput()).toHaveValue(20));

    await userEvent.clear(capInput());
    await userEvent.type(capInput(), '30');
    await userEvent.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid request body');
    expect(mockNotify).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({
        title: 'Unable to update discount cap',
        text: 'Invalid request body',
      })
    );
    // The displayed cap must keep showing server truth, not the rejected entry.
    expect(screen.getByText(/currently capped at 20%/i)).toBeInTheDocument();
  });

  it('surfaces a load failure and retries', async () => {
    discountSettingsMock.getOrganisationDiscountSettings
      .mockRejectedValueOnce(new Error('Organisation not found.'))
      .mockResolvedValueOnce({ organisationId: 'org-1', maxOverallDiscountPercent: 20 });

    render(<ProtectedDiscounts />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Organisation not found.');

    await userEvent.click(screen.getByRole('button', { name: /retry loading the discount cap/i }));

    await waitFor(() => expect(capInput()).toHaveValue(20));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(discountSettingsMock.getOrganisationDiscountSettings).toHaveBeenCalledTimes(2);
  });

  it('does not query without a primary organisation', async () => {
    orgStoreState.primaryOrgId = null;

    render(<ProtectedDiscounts />);

    await screen.findByRole('heading', { level: 1, name: 'Discounts' });
    expect(discountSettingsMock.getOrganisationDiscountSettings).not.toHaveBeenCalled();
  });

  it('links back to the invoices list', async () => {
    render(<ProtectedDiscounts />);

    expect(await screen.findByRole('link', { name: 'Back to invoices' })).toHaveAttribute(
      'href',
      '/finance'
    );
  });
});
