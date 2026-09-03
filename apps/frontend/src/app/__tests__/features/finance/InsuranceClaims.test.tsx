import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Renders children so the gated action row is exercised; the permission logic
// itself is covered by PermissionGate's own tests.
jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, ariaLabel, onClick, isDisabled }: any) => (
    <button type="button" aria-label={ariaLabel} onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ text, ariaLabel, onClick, isDisabled }: any) => (
    <button type="button" aria-label={ariaLabel} onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/GlassTooltip/GlassTooltip', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

// Passthrough: the modal's portal/overlay behaviour is covered by CenterModal's
// own tests, and rendering the children inline keeps the form queryable.
jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children, ariaLabel }: any) =>
    showModal ? (
      <div role="dialog" aria-label={ariaLabel}>
        {children}
      </div>
    ) : null,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import InsuranceClaims, {
  type InsuranceClaimsProps,
} from '@/app/features/finance/pages/InsuranceClaims/InsuranceClaims';
import type {
  InsuranceClaim,
  InsuranceClaimStatus,
} from '@/app/features/finance/types/insuranceClaim';

const makeClaim = (
  overrides: Partial<InsuranceClaim> & { id: string; status: InsuranceClaimStatus }
): InsuranceClaim => ({
  organisationId: 'org-1',
  patientId: 'pat-1',
  invoiceId: null,
  encounterId: null,
  insurerName: 'Petsure',
  policyNumber: 'PS-2291',
  claimNumber: null,
  submittedAmount: 420,
  approvedAmount: null,
  paidAmount: null,
  currency: 'GBP',
  submittedAt: null,
  approvedAt: null,
  paidAt: null,
  rejectionReason: null,
  notes: null,
  externalClaimRef: null,
  createdAt: '2026-08-28T09:00:00.000Z',
  updatedAt: '2026-08-28T09:00:00.000Z',
  ...overrides,
});

const CLAIMS: InsuranceClaim[] = [
  makeClaim({ id: 'c1', status: 'DRAFT', patientId: 'pat-1', submittedAmount: 420 }),
  makeClaim({
    id: 'c2',
    status: 'SUBMITTED',
    patientId: 'pat-2',
    insurerName: 'Bought By Many',
    policyNumber: 'BBM-8841',
    claimNumber: 'CLM-5567',
    submittedAmount: 199.5,
  }),
  makeClaim({
    id: 'c3',
    status: 'PARTIALLY_APPROVED',
    patientId: 'pat-3',
    insurerName: 'Agria',
    policyNumber: 'AG-1200',
    submittedAmount: 1240.6,
    approvedAmount: 900,
  }),
  makeClaim({
    id: 'c4',
    status: 'REJECTED',
    patientId: 'pat-1',
    submittedAmount: 310,
    rejectionReason: 'Pre-existing condition excluded.',
  }),
];

const NAMES: Record<string, string> = {
  'pat-1': 'Marnie Whitlock',
  'pat-2': 'Rufus Delacroix',
  'pat-3': 'Pepper Osei',
};

const noop = () => {};

const baseProps: InsuranceClaimsProps = {
  claims: CLAIMS,
  loading: false,
  error: null,
  onReload: noop,
  emptyMessage: 'File a claim to recover a treatment cost.',
  activeStatus: 'all',
  onStatusChange: noop,
  companionName: (patientId: string) => NAMES[patientId] ?? 'Unknown companion',
  companions: [
    { id: 'pat-1', name: 'Marnie Whitlock' },
    { id: 'pat-2', name: 'Rufus Delacroix' },
  ],
  currency: 'GBP',
  activeClaimId: null,
  onSelect: noop,
  pendingAction: null,
  actionError: null,
  onSubmitClaim: noop,
  onCancelClaim: noop,
  onUpdateStatus: noop,
  createOpen: false,
  onCreateOpenChange: noop,
  creating: false,
  createError: null,
  onCreate: noop,
};

const setup = (overrides: Partial<InsuranceClaimsProps> = {}) => {
  const props = { ...baseProps, ...overrides };
  const view = render(<InsuranceClaims {...props} />);
  return { props, ...view };
};

const table = () => screen.getByRole('table');

describe('InsuranceClaims list', () => {
  it('renders a row per claim with the insurer, policy and status pill', () => {
    setup();

    const rows = within(table());
    expect(rows.getByText('Bought By Many')).toBeInTheDocument();
    expect(rows.getByText('BBM-8841')).toBeInTheDocument();
    // Status pills sit in the table; their labels are distinct from the column
    // headers ("Submitted"/"Approved"/"Paid"), so these are unambiguous.
    expect(rows.getByText('Draft')).toBeInTheDocument();
    expect(rows.getByText('Partially approved')).toBeInTheDocument();
    expect(rows.getByText('Rejected')).toBeInTheDocument();
  });

  it('formats the submitted and approved amounts, keeping the minor units', () => {
    setup();

    const rows = within(table());
    // 199.5 must not print as "£200", and 1240.6 keeps both digits.
    expect(rows.getByText('£199.50')).toBeInTheDocument();
    expect(rows.getByText('£1,240.60')).toBeInTheDocument();
    expect(rows.getByText('£900.00')).toBeInTheDocument();
  });

  it('shows a dash for figures the insurer has not decided yet', () => {
    setup({ claims: [CLAIMS[0]] });

    // A DRAFT has no claim number, no approved amount and no paid amount.
    expect(within(table()).getAllByText('-').length).toBeGreaterThanOrEqual(3);
  });

  it('shows the empty state with the supplied reason', () => {
    setup({ claims: [], emptyMessage: 'No claim matches that search.' });

    expect(screen.getByText('No insurance claims yet')).toBeInTheDocument();
    expect(screen.getByText('No claim matches that search.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders the loading placeholder and no table while loading', () => {
    setup({ claims: [], loading: true });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('No insurance claims yet')).not.toBeInTheDocument();
  });

  it('surfaces a load error with a retry', async () => {
    const onReload = jest.fn();
    setup({ claims: [], error: 'Unable to load insurance claims.', onReload });

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load insurance claims.');
    await userEvent.click(screen.getByRole('button', { name: 'Retry loading insurance claims' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});

describe('InsuranceClaims detail actions', () => {
  it('offers Submit and Cancel on a DRAFT and no status picker', async () => {
    const onSubmitClaim = jest.fn();
    setup({ claims: [CLAIMS[0]], activeClaimId: 'c1', onSubmitClaim });

    expect(screen.queryByLabelText('Move claim to')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel this claim' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Submit this claim to the insurer' }));
    expect(onSubmitClaim).toHaveBeenCalledTimes(1);
  });

  it('offers a status picker and Cancel, but no Submit, on a SUBMITTED claim', () => {
    setup({ claims: [CLAIMS[1]], activeClaimId: 'c2' });

    expect(screen.getByLabelText('Move claim to')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Submit this claim to the insurer' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel this claim' })).toBeInTheDocument();
  });

  it('requires an approved amount before approving, then submits it', async () => {
    const onUpdateStatus = jest.fn();
    setup({ claims: [CLAIMS[1]], activeClaimId: 'c2', onUpdateStatus });

    await userEvent.selectOptions(screen.getByLabelText('Move claim to'), 'APPROVED');
    await userEvent.click(screen.getByRole('button', { name: "Update this claim's status" }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter the amount the insurer approved.'
    );
    expect(onUpdateStatus).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Approved amount'), '150');
    await userEvent.click(screen.getByRole('button', { name: "Update this claim's status" }));

    expect(onUpdateStatus).toHaveBeenCalledWith({ status: 'APPROVED', approvedAmount: 150 });
  });

  it('rejects an approved amount above the submitted amount', async () => {
    const onUpdateStatus = jest.fn();
    // c2 was submitted for 199.5; approving for 500 must be caught client-side.
    setup({ claims: [CLAIMS[1]], activeClaimId: 'c2', onUpdateStatus });

    await userEvent.selectOptions(screen.getByLabelText('Move claim to'), 'APPROVED');
    await userEvent.type(screen.getByLabelText('Approved amount'), '500');
    await userEvent.click(screen.getByRole('button', { name: "Update this claim's status" }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Approved amount cannot exceed the submitted amount.'
    );
    expect(onUpdateStatus).not.toHaveBeenCalled();
  });

  it('records a paid amount when settling an approved claim', async () => {
    const onUpdateStatus = jest.fn();
    const approved = makeClaim({
      id: 'c9',
      status: 'APPROVED',
      submittedAmount: 400,
      approvedAmount: 320,
    });
    setup({ claims: [approved], activeClaimId: 'c9', onUpdateStatus });

    // The only forward move from APPROVED is PAID, so it is the default option.
    await userEvent.type(screen.getByLabelText('Paid amount'), '320');
    await userEvent.click(screen.getByRole('button', { name: "Update this claim's status" }));

    expect(onUpdateStatus).toHaveBeenCalledWith({ status: 'PAID', paidAmount: 320 });
  });

  it('offers no actions on a terminal PAID claim', () => {
    const paid = makeClaim({
      id: 'c10',
      status: 'PAID',
      submittedAmount: 88,
      approvedAmount: 88,
      paidAmount: 88,
    });
    setup({ claims: [paid], activeClaimId: 'c10' });

    expect(screen.queryByLabelText('Move claim to')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Submit this claim to the insurer' })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel this claim' })).not.toBeInTheDocument();
  });
});

describe('InsuranceClaims create form', () => {
  it('opens the form from the header button', async () => {
    const onCreateOpenChange = jest.fn();
    setup({ onCreateOpenChange });

    await userEvent.click(screen.getByRole('button', { name: 'Create a new insurance claim' }));
    expect(onCreateOpenChange).toHaveBeenCalledWith(true);
  });

  it('blocks a submit with no companion chosen', async () => {
    const onCreate = jest.fn();
    setup({ createOpen: true, claims: [], onCreate });

    await userEvent.click(screen.getByRole('button', { name: 'Create this insurance claim' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a companion for this claim.'
    );
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('submits a complete draft as a CreateInsuranceClaimInput', async () => {
    const onCreate = jest.fn();
    setup({ createOpen: true, claims: [], onCreate });

    await userEvent.selectOptions(screen.getByLabelText('Companion'), 'pat-1');
    await userEvent.clear(screen.getByLabelText('Insurer'));
    await userEvent.type(screen.getByLabelText('Insurer'), 'Petsure');
    await userEvent.type(screen.getByLabelText('Policy number'), 'PS-1');
    await userEvent.type(screen.getByLabelText(/Submitted amount/), '250');
    await userEvent.click(screen.getByRole('button', { name: 'Create this insurance claim' }));

    expect(onCreate).toHaveBeenCalledWith({
      patientId: 'pat-1',
      insurerName: 'Petsure',
      policyNumber: 'PS-1',
      submittedAmount: 250,
      currency: 'GBP',
    });
    const [input] = onCreate.mock.calls[0] as [{ submittedAmount: number }];
    expect(typeof input.submittedAmount).toBe('number');
  });

  it('rejects a zero submitted amount', async () => {
    const onCreate = jest.fn();
    setup({ createOpen: true, claims: [], onCreate });

    await userEvent.selectOptions(screen.getByLabelText('Companion'), 'pat-1');
    await userEvent.type(screen.getByLabelText('Insurer'), 'Petsure');
    await userEvent.type(screen.getByLabelText('Policy number'), 'PS-1');
    await userEvent.type(screen.getByLabelText(/Submitted amount/), '0');
    await userEvent.click(screen.getByRole('button', { name: 'Create this insurance claim' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The submitted amount must be above zero.'
    );
    expect(onCreate).not.toHaveBeenCalled();
  });
});
