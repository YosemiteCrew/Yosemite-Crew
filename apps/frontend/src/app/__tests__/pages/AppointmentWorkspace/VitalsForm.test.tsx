import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import VitalsForm from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/records/VitalsForm';
import type { Vitals } from '@/app/features/appointments/types/workspace';
import { saveVitalRecord } from '@/app/features/appointments/services/workspaceClinicalService';
import { listVitalsTemplates } from '@/app/features/appointments/services/workspaceTemplateService';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';

const mockAddVitals = jest.fn();

jest.mock('@/app/stores/appointmentWorkspaceStore', () => ({
  useAppointmentWorkspaceStore: (selector: (state: { addVitals: jest.Mock }) => unknown) =>
    selector({ addVitals: mockAddVitals }),
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

const makeVitals = (overrides: Partial<Vitals> = {}): Vitals => ({
  id: 'v1',
  code: 'VT-001',
  weightLbs: 27.3,
  tempF: 101.4,
  heartRateBpm: 96,
  respRateBpm: 24,
  crtSec: '<2s',
  mucousMembrane: 'Pink',
  painScore: 2,
  bcs: 5,
  recordedByName: 'Elif Kaya',
  recordedById: 'usr-elif',
  recordedAt: '2026-07-09T08:41:00.000Z',
  ...overrides,
});

const renderForm = (
  vitals: Vitals[] = [],
  props: Partial<React.ComponentProps<typeof VitalsForm>> = {}
) =>
  render(
    <VitalsForm
      appointmentId="appt-1"
      organisationId="org-1"
      encounterId="enc-1"
      authorId="usr-logged-in"
      authorName="Dr Logged In"
      vitals={vitals}
      {...props}
    />
  );

const openCreateView = () => fireEvent.click(screen.getByRole('button', { name: /new vital/i }));

beforeEach(() => {
  jest.clearAllMocks();
  (listVitalsTemplates as jest.Mock).mockResolvedValue([]);
  (saveVitalRecord as jest.Mock).mockResolvedValue({ id: 'vital-persisted' });
  (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([]);
});

describe('VitalsForm list view', () => {
  it('renders the empty state and a New Vital affordance', async () => {
    renderForm([]);
    await waitFor(() => expect(listVitalsTemplates).toHaveBeenCalledWith('org-1'));
    expect(screen.getByText('No vitals recorded yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new vital/i })).toBeInTheDocument();
  });

  it('expands a recorded vital and shows the weight in lbs (not kg)', async () => {
    renderForm([makeVitals()]);
    await waitFor(() => expect(listVitalsTemplates).toHaveBeenCalled());

    // Collapsed row shows the record code and recorder name.
    expect(screen.getByText('VT-001')).toBeInTheDocument();
    expect(screen.getByText('Elif Kaya')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View VT-001' }));

    // Bug fix: the value is pounds, so the unit label must read "lbs".
    expect(screen.getByText('Weight: 27.3 lbs')).toBeInTheDocument();
    expect(screen.queryByText('Weight: 27.3 kg')).not.toBeInTheDocument();
    // Temperature stays in Fahrenheit.
    expect(screen.getByText('Temp: 101.4 °F')).toBeInTheDocument();
  });

  it('resolves the recorder name from the team roster when only an id is stored', async () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: 'usr-elif', practionerId: 'prac-elif', name: 'Dr Elif Kaya' },
    ]);
    renderForm([makeVitals({ recordedByName: 'Clinician', recordedById: 'usr-elif' })]);
    await waitFor(() => expect(listVitalsTemplates).toHaveBeenCalled());
    expect(screen.getByText('Dr Elif Kaya')).toBeInTheDocument();
  });

  it('falls back to a generic clinician label when no recorder id or name resolves', async () => {
    renderForm([makeVitals({ recordedByName: 'Clinician', recordedById: undefined })]);
    await waitFor(() => expect(listVitalsTemplates).toHaveBeenCalled());
    expect(screen.getByText('Clinician')).toBeInTheDocument();
  });
});

describe('VitalsForm create view', () => {
  it('opens the create form with the numeric grid and Observation tools', async () => {
    renderForm([]);
    await waitFor(() => expect(listVitalsTemplates).toHaveBeenCalled());
    openCreateView();

    expect(screen.getByText('New vitals')).toBeInTheDocument();
    expect(screen.getByLabelText('Search vitals templates')).toBeInTheDocument();
    // Remaining numeric inputs stay as free inputs.
    expect(screen.getByLabelText('Weight')).toBeInTheDocument();
    expect(screen.getByLabelText('Temperature')).toBeInTheDocument();
    expect(screen.getByLabelText('Heart rate')).toBeInTheDocument();
    expect(screen.getByLabelText('Respiratory rate')).toBeInTheDocument();
    // Observation-tool group replaces the free BCS/Pain/Mucous inputs.
    expect(screen.getByText('Observation tools')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Body condition score' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Pain score' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Mucous membranes' })).toBeInTheDocument();
  });

  it('toggles aria-pressed when selecting BCS, Pain and Mucous membrane segments', async () => {
    renderForm([]);
    await waitFor(() => expect(listVitalsTemplates).toHaveBeenCalled());
    openCreateView();

    const bcs = screen.getByRole('button', { name: 'Body condition score 5' });
    const pain = screen.getByRole('button', { name: 'Pain score 4' });
    const mucous = screen.getByRole('button', { name: 'Mucous membranes Pink' });

    expect(bcs).toHaveAttribute('aria-pressed', 'false');
    expect(pain).toHaveAttribute('aria-pressed', 'false');
    expect(mucous).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(bcs);
    fireEvent.click(pain);
    fireEvent.click(mucous);

    expect(bcs).toHaveAttribute('aria-pressed', 'true');
    expect(bcs).toHaveClass('bg-neutral-900');
    expect(pain).toHaveAttribute('aria-pressed', 'true');
    expect(mucous).toHaveAttribute('aria-pressed', 'true');
    // A non-selected sibling stays in the unselected skin.
    expect(screen.getByRole('button', { name: 'Body condition score 6' })).toHaveClass(
      'border-input-border-default'
    );
  });

  it('blocks save and surfaces validation errors when required vitals are empty', async () => {
    renderForm([]);
    await waitFor(() => expect(listVitalsTemplates).toHaveBeenCalled());
    openCreateView();

    fireEvent.click(screen.getByRole('button', { name: /save vitals/i }));

    expect(saveVitalRecord).not.toHaveBeenCalled();
    expect(mockAddVitals).not.toHaveBeenCalled();
    expect(screen.getByText('Weight is required.')).toBeInTheDocument();
    // Segmented-picker errors render under their controls.
    expect(screen.getByText('BCS is required.')).toBeInTheDocument();
    expect(screen.getByText('Pain score is required.')).toBeInTheDocument();
    expect(screen.getByText(/please fix the highlighted vitals fields/i)).toBeInTheDocument();
  });

  it('surfaces range errors from validateNumericField for the segmented pain score', async () => {
    renderForm([]);
    await waitFor(() => expect(listVitalsTemplates).toHaveBeenCalled());
    openCreateView();

    // Fill the numeric inputs with valid values so only the picker range fails.
    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '55' } });
    fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '101' } });
    fireEvent.change(screen.getByLabelText('Heart rate'), { target: { value: '88' } });
    fireEvent.change(screen.getByLabelText('Respiratory rate'), { target: { value: '22' } });
    // Select BCS but leave pain empty -> pain is still required.
    fireEvent.click(screen.getByRole('button', { name: 'Body condition score 5' }));
    fireEvent.click(screen.getByRole('button', { name: /save vitals/i }));

    expect(saveVitalRecord).not.toHaveBeenCalled();
    expect(screen.getByText('Pain score is required.')).toBeInTheDocument();
    expect(screen.queryByText('BCS is required.')).not.toBeInTheDocument();
  });

  it('saves a valid record via the segmented pickers and returns to the list', async () => {
    renderForm([]);
    await waitFor(() => expect(listVitalsTemplates).toHaveBeenCalled());
    openCreateView();

    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '55' } });
    fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '101' } });
    fireEvent.change(screen.getByLabelText('Heart rate'), { target: { value: '88' } });
    fireEvent.change(screen.getByLabelText('Respiratory rate'), { target: { value: '22' } });
    fireEvent.click(screen.getByRole('button', { name: 'Body condition score 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pain score 4' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mucous membranes Pale' }));

    fireEvent.click(screen.getByRole('button', { name: /save vitals/i }));

    await waitFor(() => expect(saveVitalRecord).toHaveBeenCalledTimes(1));

    const [context, vital] = (saveVitalRecord as jest.Mock).mock.calls[0];
    expect(context).toMatchObject({
      organisationId: 'org-1',
      appointmentId: 'appt-1',
      encounterId: 'enc-1',
      authorId: 'usr-logged-in',
    });
    expect(vital).toMatchObject({
      weightLbs: 55,
      tempF: 101,
      heartRateBpm: 88,
      respRateBpm: 22,
      bcs: 5,
      painScore: 4,
      mucousMembrane: 'Pale',
      recordedByName: 'Dr Logged In',
      recordedById: 'usr-logged-in',
    });

    await waitFor(() =>
      expect(mockAddVitals).toHaveBeenCalledWith('appt-1', expect.any(Object), 'vital-persisted')
    );
    // Back to the list view (create heading gone, New Vital affordance back).
    await waitFor(() => expect(screen.queryByText('New vitals')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /new vital/i })).toBeInTheDocument();
  });

  it('discards the draft and returns to the list', async () => {
    renderForm([]);
    await waitFor(() => expect(listVitalsTemplates).toHaveBeenCalled());
    openCreateView();
    expect(screen.getByText('New vitals')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /discard/i }));

    expect(screen.queryByText('New vitals')).not.toBeInTheDocument();
    expect(saveVitalRecord).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /new vital/i })).toBeInTheDocument();
  });

  it('surfaces a save failure and stays on the create view', async () => {
    (saveVitalRecord as jest.Mock).mockRejectedValueOnce(new Error('network'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    renderForm([]);
    await waitFor(() => expect(listVitalsTemplates).toHaveBeenCalled());
    openCreateView();

    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '55' } });
    fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '101' } });
    fireEvent.change(screen.getByLabelText('Heart rate'), { target: { value: '88' } });
    fireEvent.change(screen.getByLabelText('Respiratory rate'), { target: { value: '22' } });
    fireEvent.click(screen.getByRole('button', { name: 'Body condition score 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pain score 4' }));
    fireEvent.click(screen.getByRole('button', { name: /save vitals/i }));

    expect(await screen.findByText(/unable to save vitals/i)).toBeInTheDocument();
    expect(mockAddVitals).not.toHaveBeenCalled();
    // Still on the create view.
    expect(screen.getByText('New vitals')).toBeInTheDocument();
    errorSpy.mockRestore();
  });
});

describe('VitalsForm template search and weight trend', () => {
  it('applies a matching template and relabels the numeric inputs', async () => {
    (listVitalsTemplates as jest.Mock).mockResolvedValue([
      {
        id: 'tpl-1',
        name: 'Feline vitals',
        versions: [],
        schemaSnapshot: {
          sections: [
            {
              fields: [{ id: 'f-weight', label: 'Body weight', type: 'number' }],
            },
          ],
        },
      },
    ]);
    renderForm([]);
    await waitFor(() => expect(listVitalsTemplates).toHaveBeenCalled());
    openCreateView();

    fireEvent.change(screen.getByLabelText('Search vitals templates'), {
      target: { value: 'feline' },
    });
    fireEvent.click(await screen.findByText('Feline vitals'));

    // The template's weight field label is applied to the numeric grid input.
    expect(screen.getByLabelText('Body weight')).toBeInTheDocument();
  });

  it('shows a weight-trend chip computed from the two most recent weighed records', async () => {
    const newest = makeVitals({
      id: 'new',
      weightLbs: 27.6,
      recordedAt: '2026-07-09T08:41:00.000Z',
    });
    const previous = makeVitals({
      id: 'old',
      weightLbs: 27.3,
      recordedAt: '2026-06-12T08:41:00.000Z',
    });
    renderForm([newest, previous]);
    await waitFor(() => expect(listVitalsTemplates).toHaveBeenCalled());
    openCreateView();

    expect(screen.getByText(/\+0\.3 lbs since/i)).toBeInTheDocument();
  });

  it('shows a downward weight-trend chip when the newest record is lighter', async () => {
    const newest = makeVitals({
      id: 'new',
      weightLbs: 27.0,
      recordedAt: '2026-07-09T08:41:00.000Z',
    });
    const previous = makeVitals({
      id: 'old',
      weightLbs: 27.5,
      recordedAt: '2026-06-12T08:41:00.000Z',
    });
    renderForm([newest, previous]);
    await waitFor(() => expect(listVitalsTemplates).toHaveBeenCalled());
    openCreateView();

    expect(screen.getByText(/-0\.5 lbs since/i)).toBeInTheDocument();
  });

  it('omits the weight-trend chip when fewer than two weighed records exist', async () => {
    renderForm([makeVitals({ weightLbs: 27.3 })]);
    await waitFor(() => expect(listVitalsTemplates).toHaveBeenCalled());
    openCreateView();

    expect(screen.queryByText(/lbs since/i)).not.toBeInTheDocument();
  });
});
