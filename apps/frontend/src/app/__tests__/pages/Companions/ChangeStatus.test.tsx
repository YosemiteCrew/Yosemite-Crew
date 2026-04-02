import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import ChangeCompanionStatus from '@/app/features/companions/pages/Companions/ChangeStatus';
import { updateCompanion } from '@/app/features/companions/services/companionService';

const modalSpy = jest.fn();

jest.mock('@/app/features/companions/services/companionService', () => ({
  updateCompanion: jest.fn(),
}));

jest.mock('@/app/ui/overlays/Modal/ChangeStatusModal', () => ({
  __esModule: true,
  default: (props: any) => {
    modalSpy(props);
    return <div data-testid="companion-change-status-modal" />;
  },
}));

describe('Companion ChangeStatus wrapper', () => {
  const setShowModal = jest.fn();
  const activeCompanion: any = {
    companion: {
      _id: 'comp-1',
      status: 'active',
      name: 'Mochi',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes current status and expected options to modal', () => {
    render(
      <ChangeCompanionStatus
        showModal
        setShowModal={setShowModal}
        activeCompanion={activeCompanion}
      />
    );

    const props = modalSpy.mock.calls[0][0];
    expect(props.currentStatus).toBe('active');
    expect(props.defaultStatus).toBe('active');
    expect(props.statusOptions).toEqual([
      { value: 'active', label: 'Active' },
      { value: 'archived', label: 'Archived' },
    ]);
  });

  it('updates companion status using service on save', async () => {
    (updateCompanion as jest.Mock).mockResolvedValue({});

    render(
      <ChangeCompanionStatus
        showModal
        setShowModal={setShowModal}
        activeCompanion={activeCompanion}
      />
    );

    const props = modalSpy.mock.calls[0][0];
    await props.onSave('archived');

    expect(updateCompanion).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'comp-1', status: 'archived' })
    );
  });
});
