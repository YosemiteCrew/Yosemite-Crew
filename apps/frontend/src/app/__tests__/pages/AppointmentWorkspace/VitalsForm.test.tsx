import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VitalsForm from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/records/VitalsForm';
import {
  INITIAL_VITALS_FORM_DRAFT_STATE,
  vitalsFormDraftReducer,
} from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/records/vitalsFormDraft';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { saveVitalRecord } from '@/app/features/appointments/services/workspaceClinicalService';
import { listVitalsTemplates } from '@/app/features/appointments/services/workspaceTemplateService';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import type { Vitals } from '@/app/features/appointments/types/workspace';

jest.mock('@/app/stores/appointmentWorkspaceStore', () => ({
  useAppointmentWorkspaceStore: jest.fn(),
}));

jest.mock('@/app/features/appointments/services/workspaceClinicalService', () => ({
  saveVitalRecord: jest.fn(),
}));

jest.mock('@/app/features/appointments/services/workspaceTemplateService', () => ({
  listVitalsTemplates: jest.fn(),
}));

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: jest.fn(),
}));

const addVitals = jest.fn();

const baseProps = {
  appointmentId: 'appt-1',
  organisationId: 'org-1',
  encounterId: 'enc-1',
  authorId: 'user-1',
  authorName: 'Dr Vet',
  vitals: [] as Vitals[],
};

describe('VitalsForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAppointmentWorkspaceStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ addVitals })
    );
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([]);
    (listVitalsTemplates as jest.Mock).mockResolvedValue([]);
    (saveVitalRecord as jest.Mock).mockResolvedValue({ id: 'vital-1' });
  });

  it('shows the empty state and opens the new-vitals form', async () => {
    render(<VitalsForm {...baseProps} />);
    expect(screen.getByText('No vitals recorded yet.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New Vital' }));
    expect(await screen.findByText('New vitals')).toBeInTheDocument();
  });

  it('validates required numeric fields and blocks save', async () => {
    render(<VitalsForm {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'New Vital' }));
    await screen.findByText('New vitals');

    fireEvent.click(screen.getByRole('button', { name: 'Save vitals' }));

    expect(
      await screen.findByText('Please fix the highlighted vitals fields.')
    ).toBeInTheDocument();
    expect(saveVitalRecord).not.toHaveBeenCalled();
  });

  it('saves a template that renders only a subset of the vitals fields', async () => {
    // The template maps Weight + Temperature only; the four fields it omits are never
    // rendered, so requiring them would block save with errors nothing can display.
    (listVitalsTemplates as jest.Mock).mockResolvedValue([
      {
        id: 'tpl-1',
        name: 'Quick weight check',
        schemaSnapshot: {
          sections: [
            {
              fields: [
                { key: 'weight', label: 'Weight' },
                { key: 'temperature', label: 'Temperature' },
              ],
            },
          ],
        },
      },
    ]);

    render(<VitalsForm {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'New Vital' }));
    await screen.findByText('New vitals');

    fireEvent.change(screen.getByLabelText('Search vitals templates'), {
      target: { value: 'Quick' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Quick weight check' }));

    expect(screen.queryByLabelText('Heart rate')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('BCS')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '42' } });
    fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '101' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save vitals' }));

    await waitFor(() => expect(saveVitalRecord).toHaveBeenCalled());
    expect(screen.queryByText('Please fix the highlighted vitals fields.')).not.toBeInTheDocument();
  });

  it('still validates a bounded field the active template does render', async () => {
    (listVitalsTemplates as jest.Mock).mockResolvedValue([
      {
        id: 'tpl-1',
        name: 'Quick weight check',
        schemaSnapshot: { sections: [{ fields: [{ key: 'weight', label: 'Weight' }] }] },
      },
    ]);

    render(<VitalsForm {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'New Vital' }));
    await screen.findByText('New vitals');

    fireEvent.change(screen.getByLabelText('Search vitals templates'), {
      target: { value: 'Quick' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Quick weight check' }));

    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save vitals' }));

    expect(await screen.findByText('Weight must be 2000 or less.')).toBeInTheDocument();
    expect(saveVitalRecord).not.toHaveBeenCalled();
  });

  it('updates a draft field via typing, then saves and resets the form', async () => {
    render(<VitalsForm {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'New Vital' }));
    await screen.findByText('New vitals');

    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '42' } });
    fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '101' } });
    fireEvent.change(screen.getByLabelText('Heart rate'), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText('Respiratory rate'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pain score 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Body condition score 5' }));
    fireEvent.change(screen.getByLabelText('Vitals notes'), { target: { value: 'Looks good' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save vitals' }));

    await waitFor(() => expect(saveVitalRecord).toHaveBeenCalledTimes(1));
    expect(addVitals).toHaveBeenCalledWith(
      'appt-1',
      expect.objectContaining({ weightLbs: 42, notes: 'Looks good' }),
      'vital-1'
    );

    // Form resets to the list view after a successful save.
    expect(await screen.findByText('No vitals recorded yet.')).toBeInTheDocument();
  });

  it('discards the draft without saving', async () => {
    render(<VitalsForm {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'New Vital' }));
    await screen.findByText('New vitals');

    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    expect(await screen.findByText('No vitals recorded yet.')).toBeInTheDocument();
    expect(saveVitalRecord).not.toHaveBeenCalled();

    // Reopening shows a clean draft (reducer RESET bailout didn't leave stale values).
    fireEvent.click(screen.getByRole('button', { name: 'New Vital' }));
    await screen.findByText('New vitals');
    expect(screen.getByLabelText('Weight')).toHaveValue('');
  });

  it('shows a save error and keeps the form open when the save fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (saveVitalRecord as jest.Mock).mockRejectedValue(new Error('network error'));
    render(<VitalsForm {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'New Vital' }));
    await screen.findByText('New vitals');

    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '42' } });
    fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '101' } });
    fireEvent.change(screen.getByLabelText('Heart rate'), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText('Respiratory rate'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pain score 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Body condition score 5' }));

    fireEvent.click(screen.getByRole('button', { name: 'Save vitals' }));

    expect(await screen.findByText('Unable to save vitals. Please try again.')).toBeInTheDocument();
    expect(addVitals).not.toHaveBeenCalled();
    // Still on the form (not reset) after a failed save.
    expect(screen.getByText('New vitals')).toBeInTheDocument();
  });

  it('reports a below-minimum numeric field error', async () => {
    render(<VitalsForm {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'New Vital' }));
    await screen.findByText('New vitals');

    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save vitals' }));

    expect(await screen.findByText('Weight must be at least 0.')).toBeInTheDocument();
    expect(saveVitalRecord).not.toHaveBeenCalled();
  });

  it('reports an above-maximum numeric field error', async () => {
    render(<VitalsForm {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'New Vital' }));
    await screen.findByText('New vitals');

    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save vitals' }));

    expect(await screen.findByText('Weight must be 2000 or less.')).toBeInTheDocument();
    expect(saveVitalRecord).not.toHaveBeenCalled();
  });

  it('surfaces an error when vitals templates fail to load', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (listVitalsTemplates as jest.Mock).mockRejectedValue(new Error('boom'));
    render(<VitalsForm {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'New Vital' }));

    expect(await screen.findByText('Unable to load vitals templates.')).toBeInTheDocument();
  });

  it('applies a versioned vitals template to relabel the fields', async () => {
    (listVitalsTemplates as jest.Mock).mockResolvedValue([
      {
        id: 'tpl-vitals',
        name: 'Full vitals panel',
        latestVersion: 1,
        publishedVersion: 1,
        versions: [
          {
            version: 1,
            schemaSnapshot: {
              sections: [
                {
                  id: 's1',
                  title: 'Vitals',
                  fields: [
                    { key: 'weight', label: 'Body weight', rules: { unit: 'kg' } },
                    { key: 'temp', label: 'Body temp', rules: { unit: '°C' } },
                  ],
                },
              ],
            },
          },
        ],
      },
    ]);
    render(<VitalsForm {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'New Vital' }));
    await screen.findByText('New vitals');

    fireEvent.change(screen.getByLabelText('Search vitals templates'), {
      target: { value: 'full' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Full vitals panel' }));

    // The template's field labels/units replace the fallbacks.
    expect(await screen.findByLabelText('Body weight')).toBeInTheDocument();
    expect(screen.getByText('kg')).toBeInTheDocument();
  });

  it('falls back to the default fields when a root-snapshot template maps no vitals', async () => {
    (listVitalsTemplates as jest.Mock).mockResolvedValue([
      {
        id: 'tpl-empty',
        name: 'Unmapped template',
        schemaSnapshot: {
          sections: [{ id: 's', title: 'Other', fields: [{ key: 'foo', label: 'Foo' }] }],
        },
      },
    ]);
    render(<VitalsForm {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'New Vital' }));
    await screen.findByText('New vitals');

    fireEvent.change(screen.getByLabelText('Search vitals templates'), {
      target: { value: 'unmapped' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Unmapped template' }));

    // No field mapped → the default vitals fields remain.
    expect(await screen.findByLabelText('Weight')).toBeInTheDocument();
    expect(screen.getByLabelText('Temperature')).toBeInTheDocument();
  });

  it('renders an increasing weight trend badge when the form is open', async () => {
    const vitals = [
      {
        id: 'v2',
        code: 'Vitals',
        recordedByName: 'Dr Vet',
        recordedAt: '2026-05-02T10:00:00Z',
        weightLbs: 44,
      },
      {
        id: 'v1',
        code: 'Vitals',
        recordedByName: 'Dr Vet',
        recordedAt: '2026-05-01T10:00:00Z',
        weightLbs: 42,
      },
    ] as Vitals[];
    render(<VitalsForm {...baseProps} vitals={vitals} />);
    fireEvent.click(screen.getByRole('button', { name: 'New Vital' }));

    expect(await screen.findByText(/\+2 lbs since/)).toBeInTheDocument();
  });

  it('renders a decreasing weight trend badge when the form is open', async () => {
    const vitals = [
      {
        id: 'v2',
        code: 'Vitals',
        recordedByName: 'Dr Vet',
        recordedAt: '2026-05-02T10:00:00Z',
        weightLbs: 40,
      },
      {
        id: 'v1',
        code: 'Vitals',
        recordedByName: 'Dr Vet',
        recordedAt: '2026-05-01T10:00:00Z',
        weightLbs: 45,
      },
    ] as Vitals[];
    render(<VitalsForm {...baseProps} vitals={vitals} />);
    fireEvent.click(screen.getByRole('button', { name: 'New Vital' }));

    expect(await screen.findByText(/-5 lbs since/)).toBeInTheDocument();
  });

  describe('vitalsFormDraftReducer', () => {
    it('returns the same state reference when RESET is dispatched on an already-empty state', () => {
      expect(vitalsFormDraftReducer(INITIAL_VITALS_FORM_DRAFT_STATE, { type: 'RESET' })).toBe(
        INITIAL_VITALS_FORM_DRAFT_STATE
      );
    });

    it('returns the current state for an unknown action', () => {
      expect(
        vitalsFormDraftReducer(INITIAL_VITALS_FORM_DRAFT_STATE, {
          type: 'UNKNOWN',
        } as unknown as Parameters<typeof vitalsFormDraftReducer>[1])
      ).toBe(INITIAL_VITALS_FORM_DRAFT_STATE);
    });
  });
});
