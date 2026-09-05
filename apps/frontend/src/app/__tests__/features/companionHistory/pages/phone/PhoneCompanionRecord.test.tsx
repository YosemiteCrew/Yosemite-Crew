import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PhoneCompanionRecord from '@/app/features/companionHistory/pages/phone/PhoneCompanionRecord';

// The reused timeline is exercised in its own suite; here it stands in for a
// marker that echoes the props the phone screen threads through to it.
jest.mock('@/app/features/companionHistory/components/CompanionHistoryTimeline', () => ({
  __esModule: true,
  default: ({ companionId, variant, showDocumentUpload, openMedicalRecordsSignal }: any) => (
    <div data-testid="timeline">
      {`${companionId}-${variant}-${String(showDocumentUpload)}-${openMedicalRecordsSignal}`}
    </div>
  ),
}));

jest.mock('@/app/features/companionHistory/components/AllergyListPanel', () => ({
  __esModule: true,
  default: ({ companionId }: any) => (
    <div data-testid="allergy-list-panel" data-companion-id={companionId} />
  ),
}));

jest.mock('@/app/features/companionHistory/components/FlagListPanel', () => ({
  __esModule: true,
  default: ({ companionId }: any) => (
    <div data-testid="flag-list-panel" data-companion-id={companionId} />
  ),
}));

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  __esModule: true,
  default: ({ children }: any) => children,
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span data-testid="avatar">{alt}</span>,
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: (url?: string) => url ?? '/fallback.png',
}));

const buildRecord = (overrides: { companion?: any; parent?: any } = {}) => ({
  companion: {
    id: 'AC-0092',
    name: 'Poppy',
    photoUrl: '/poppy.jpg',
    type: 'dog',
    breed: 'Beagle',
    gender: 'female',
    isneutered: true,
    currentWeight: 12.4,
    dateOfBirth: new Date('2022-05-03'),
    bloodGroup: 'DEA 1.1 positive',
    microchipNumber: '756098233341205',
    allergy: 'Penicillin',
    ...overrides.companion,
  },
  parent: {
    id: 'CL-0048',
    firstName: 'Lena',
    lastName: 'Hartmann',
    phoneNumber: '+49 171 555 0192',
    profileImageUrl: '',
    ...overrides.parent,
  },
});

const noop = () => {};

const renderRecord = (props: Partial<React.ComponentProps<typeof PhoneCompanionRecord>> = {}) =>
  render(
    <PhoneCompanionRecord
      companionId="AC-0092"
      activeCompanion={buildRecord()}
      title="Poppy's overview"
      companionAlerts={[]}
      clientAlerts={[]}
      canEdit
      replaceCompanionText={(text) => text}
      onBack={noop}
      onEdit={noop}
      onAddAppointment={noop}
      onAddCompanionAlert={noop}
      onRemoveCompanionAlert={noop}
      {...props}
    />
  );

describe('PhoneCompanionRecord', () => {
  it('renders the identity, meta line, parent contact and the phone-variant timeline', () => {
    renderRecord();

    expect(screen.getByText("Poppy's overview")).toBeInTheDocument();
    expect(screen.getAllByText('Poppy').length).toBeGreaterThan(0);
    // Signalment meta threads breed, sex, age, weight and patient id.
    expect(screen.getByText(/Beagle · Female, Spayed/)).toHaveTextContent('12.4 kg');
    expect(screen.getByText(/AC-0092$/)).toBeInTheDocument();
    // The billing badge is always present.
    expect(screen.getByText('Dues cleared')).toBeInTheDocument();
    // Parent contact card with tap-to-call / message links.
    expect(screen.getByText('Lena Hartmann')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Call Lena Hartmann' })).toHaveAttribute(
      'href',
      'tel:+49 171 555 0192'
    );
    expect(screen.getByRole('link', { name: 'Message Lena Hartmann' })).toHaveAttribute(
      'href',
      'sms:+49 171 555 0192'
    );
    // Timeline is rendered in the phone variant with the upload signal wired.
    expect(screen.getByTestId('timeline')).toHaveTextContent('AC-0092-phone-true-0');
    expect(screen.getByTestId('allergy-list-panel')).toHaveAttribute(
      'data-companion-id',
      'AC-0092'
    );
    expect(screen.getByTestId('flag-list-panel')).toHaveAttribute('data-companion-id', 'AC-0092');
  });

  it('shows the edit affordance only with permission', () => {
    const onEdit = jest.fn();
    const { rerender } = renderRecord({ onEdit });
    fireEvent.click(screen.getByRole('button', { name: 'Edit patient details' }));
    expect(onEdit).toHaveBeenCalledTimes(1);

    rerender(
      <PhoneCompanionRecord
        companionId="AC-0092"
        activeCompanion={buildRecord()}
        title="Poppy's overview"
        companionAlerts={[]}
        clientAlerts={[]}
        canEdit={false}
        replaceCompanionText={(text) => text}
        onBack={noop}
        onEdit={onEdit}
        onAddAppointment={noop}
        onAddCompanionAlert={noop}
        onRemoveCompanionAlert={noop}
      />
    );
    expect(screen.queryByRole('button', { name: 'Edit patient details' })).not.toBeInTheDocument();
  });

  it('expands and collapses the secondary details drawer', () => {
    renderRecord();

    const toggle = screen.getByRole('button', { name: /Details/ });
    expect(screen.queryByText('DEA 1.1 positive')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByText('DEA 1.1 positive')).toBeInTheDocument();
    expect(screen.getByText('Penicillin')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(toggle);
    expect(screen.queryByText('DEA 1.1 positive')).not.toBeInTheDocument();
  });

  it('advances the timeline upload signal from the action bar and books appointments', () => {
    const onAddAppointment = jest.fn();
    renderRecord({ onAddAppointment });

    expect(screen.getByTestId('timeline')).toHaveTextContent('AC-0092-phone-true-0');
    fireEvent.click(screen.getByRole('button', { name: 'Upload document' }));
    expect(screen.getByTestId('timeline')).toHaveTextContent('AC-0092-phone-true-1');

    fireEvent.click(screen.getByRole('button', { name: 'Book appointment' }));
    expect(onAddAppointment).toHaveBeenCalledTimes(1);
  });

  it('threads alert add / remove and the client preference note', () => {
    const onAddCompanionAlert = jest.fn();
    const onRemoveCompanionAlert = jest.fn();
    renderRecord({
      companionAlerts: [{ id: 'a1', label: 'Anxious patient', severity: 'medium' }],
      clientAlerts: [{ id: 'c1', label: 'Prefers evening calls', severity: 'low' }],
      onAddCompanionAlert,
      onRemoveCompanionAlert,
    });

    expect(screen.getByText('Anxious patient')).toBeInTheDocument();
    // The first client alert reads as the parent-card preference note.
    expect(screen.getByText(/Prefers evening calls/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove alert Anxious patient' }));
    expect(onRemoveCompanionAlert).toHaveBeenCalledWith('a1');

    fireEvent.click(screen.getByRole('button', { name: 'Add companion alert' }));
    expect(onAddCompanionAlert).toHaveBeenCalledTimes(1);
  });

  it('renders the parent photo when one is available', () => {
    renderRecord({ activeCompanion: buildRecord({ parent: { profileImageUrl: '/lena.jpg' } }) });
    // Companion avatar + parent photo (the initials fallback is not used).
    expect(screen.getAllByTestId('avatar')).toHaveLength(2);
    expect(screen.queryByText('LH')).not.toBeInTheDocument();
  });

  it('renders parent initials without a photo and omits call links when no phone', () => {
    renderRecord({
      activeCompanion: buildRecord({
        parent: { profileImageUrl: '', phoneNumber: '   ' },
      }),
    });

    // Initials avatar (no photo) instead of an image.
    expect(screen.getByText('LH')).toBeInTheDocument();
    // No phone number → no call / message affordances.
    expect(screen.queryByRole('link', { name: /Call/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Message/ })).not.toBeInTheDocument();
  });

  it('falls back gracefully with an unknown species and missing parent name', () => {
    renderRecord({
      activeCompanion: buildRecord({
        companion: { type: 'fish', currentWeight: undefined, dateOfBirth: undefined },
        parent: { firstName: '', lastName: '' },
      }),
    });

    // Parent card is skipped when the parent has no name.
    expect(screen.queryByRole('link', { name: /Call/ })).not.toBeInTheDocument();
    // Timeline still renders even for a sparse record.
    expect(screen.getByTestId('timeline')).toBeInTheDocument();
  });

  it('renders only the header and timeline when no companion is loaded', () => {
    renderRecord({ activeCompanion: null });

    expect(screen.getByText("Poppy's overview")).toBeInTheDocument();
    expect(screen.getByTestId('timeline')).toBeInTheDocument();
    // Identity / parent / details sections are absent without a companion.
    expect(screen.queryByText('Dues cleared')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Details/ })).not.toBeInTheDocument();
  });

  it('backs out through the header control', () => {
    const onBack = jest.fn();
    renderRecord({ onBack });
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
