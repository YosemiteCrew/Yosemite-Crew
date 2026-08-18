import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import PassportAttestationAction from '@/app/features/petPassport/components/attestation/PassportAttestationAction';
import { PERMISSIONS } from '@/app/lib/permissions';
import type { CompanionRecord } from '@/app/features/documents/types/companionDocuments';

const canMock = jest.fn();

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: canMock }),
}));

type ModalProps = {
  link: { recordId: string; status: string };
  onClose: () => void;
  onStatusChange: (status: string) => void;
};

jest.mock('@/app/features/petPassport/components/attestation/RecordAttestationModal', () => ({
  __esModule: true,
  default: ({ link, onClose, onStatusChange }: ModalProps) => (
    <div>
      <span>{`modal for ${link.recordId} (${link.status})`}</span>
      <button type="button" onClick={() => onStatusChange('SIGNED')}>
        finish attestation
      </button>
      <button type="button" onClick={onClose}>
        dismiss
      </button>
    </div>
  ),
}));

type DynamicState = { loading?: () => React.ReactNode };

// The mock records the loading option the real `dynamic(...)` call passes, so
// the skeleton the bundle budget depends on is asserted rather than assumed.
// It hangs off the mock module because a `let` in this file is still in its
// temporal dead zone when the factory runs.
jest.mock('next/dynamic', () => {
  const state: DynamicState = {};
  return {
    __esModule: true,
    __state: state,
    default: (loader: () => Promise<unknown>, options?: DynamicState) => {
      state.loading = options?.loading;
      // Exercise the real loader so the chunk's import path stays covered.
      loader().catch(() => undefined);
      const Loaded = (props: Record<string, unknown>) => {
        const mod = jest.requireMock(
          '@/app/features/petPassport/components/attestation/RecordAttestationModal'
        ) as { default: React.ComponentType<Record<string, unknown>> };
        return React.createElement(mod.default, props);
      };
      return Loaded;
    },
  };
});

const getLoadingRenderer = () =>
  (jest.requireMock('next/dynamic') as { __state: DynamicState }).__state.loading;

const linkedRecord = {
  id: 'doc-1',
  title: 'Rabies certificate',
  category: 'HEALTH',
  subcategory: 'VACCINATION',
  attachments: [],
  passportRecordId: 'artifact-1',
  passportRecordStatus: 'DRAFT',
} as unknown as CompanionRecord;

const renderAction = (record: CompanionRecord = linkedRecord) =>
  render(<PassportAttestationAction companionId="comp-1" record={record} />);

describe('PassportAttestationAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    canMock.mockReturnValue(true);
  });

  it('is hidden from staff who cannot attest', () => {
    canMock.mockReturnValue(false);

    const { container } = renderAction();

    expect(canMock).toHaveBeenCalledWith(PERMISSIONS.PASSPORT_ATTEST_ANY);
    expect(container).toBeEmptyDOMElement();
  });

  it('is hidden for a document that is not linked to a passport record', () => {
    const { container } = renderAction({
      id: 'doc-2',
      title: 'Grooming receipt',
      category: 'HYGIENE_MAINTENANCE',
      subcategory: 'GROOMING',
      attachments: [],
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('opens the review panel for the linked record and names it for screen readers', () => {
    renderAction();

    const trigger = screen.getByRole('button', {
      name: 'Review and attest: Rabies certificate',
    });
    expect(screen.queryByText(/modal for/)).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(screen.getByText('modal for artifact-1 (DRAFT)')).toBeInTheDocument();
  });

  it('reflects the new state on the trigger after the panel reports it', () => {
    renderAction();

    fireEvent.click(screen.getByRole('button', { name: /Review and attest/ }));
    fireEvent.click(screen.getByRole('button', { name: 'finish attestation' }));
    fireEvent.click(screen.getByRole('button', { name: 'dismiss' }));

    expect(screen.queryByText(/modal for/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Attested record: Rabies certificate' })
    ).toBeInTheDocument();
  });

  it('names an untitled upload rather than leaving the trigger unlabelled', () => {
    renderAction({ ...linkedRecord, title: '  ' } as CompanionRecord);

    expect(
      screen.getByRole('button', { name: 'Review and attest: Untitled document' })
    ).toBeInTheDocument();
  });

  it('labels the trigger by the status the record already carries', () => {
    renderAction({ ...linkedRecord, passportRecordStatus: 'IN_PROGRESS' } as CompanionRecord);

    expect(screen.getByRole('button', { name: /Signature pending/ })).toBeInTheDocument();
  });

  it('ships the panel behind a loading placeholder rather than in the page chunk', () => {
    renderAction();

    const { container } = render(<>{getLoadingRenderer()?.()}</>);

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});
