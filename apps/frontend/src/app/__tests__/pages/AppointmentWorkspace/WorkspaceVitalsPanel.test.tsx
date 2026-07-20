import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkspaceVitalsPanel from '@/app/features/appointments/pages/AppointmentWorkspace/components/WorkspaceVitalsPanel';
import type { ObservationRecord, Vitals } from '@/app/features/appointments/types/workspace';

const makeVitals = (overrides: Partial<Vitals> = {}): Vitals => ({
  id: 'v1',
  code: 'VITALS',
  weightLbs: 27.3,
  tempF: 101.4,
  heartRateBpm: 96,
  respRateBpm: 24,
  crtSec: '<2s',
  mucousMembrane: 'pink',
  painScore: 2,
  bcs: 5,
  recordedByName: 'Elif Kaya',
  recordedAt: '2026-07-09T08:41:00.000Z',
  ...overrides,
});

const observation: ObservationRecord = {
  id: 'o1',
  code: 'OBS',
  toolKey: 'CSU_CAP',
  toolName: 'CSU acute pain scale',
  scores: { total: 1 },
  total: 1,
  recordedByName: 'Elif Kaya',
  recordedAt: '2026-07-09T08:44:00.000Z',
};

describe('WorkspaceVitalsPanel', () => {
  it('renders the latest vitals with app units and the recorded-by stamp', () => {
    const older = makeVitals({ id: 'old', weightLbs: 10, recordedAt: '2026-07-09T07:00:00.000Z' });
    const newer = makeVitals({
      id: 'new',
      weightLbs: 27.3,
      recordedAt: '2026-07-09T08:41:00.000Z',
    });

    render(
      <WorkspaceVitalsPanel
        vitals={[older, newer]}
        observations={[observation]}
        onRecordVitals={jest.fn()}
        onOpenObservations={jest.fn()}
      />
    );

    const vitalsCard = screen.getByLabelText('Vitals');
    // latest (newer) wins over the older record
    expect(within(vitalsCard).getByText('27.3 lbs')).toBeInTheDocument();
    expect(within(vitalsCard).queryByText('10 lbs')).not.toBeInTheDocument();
    expect(within(vitalsCard).getByText('101.4 °F')).toBeInTheDocument();
    expect(within(vitalsCard).getByText('96 bpm')).toBeInTheDocument();
    expect(within(vitalsCard).getByText('24 /min')).toBeInTheDocument();
    expect(within(vitalsCard).getByText('<2s · pink')).toBeInTheDocument();
    expect(within(vitalsCard).getByText('2/10 · 5/9')).toBeInTheDocument();
    expect(within(vitalsCard).getByText(/Recorded by Elif Kaya/)).toBeInTheDocument();
  });

  it('shows dashes for missing vital fields', () => {
    render(
      <WorkspaceVitalsPanel
        vitals={[
          makeVitals({
            weightLbs: undefined,
            painScore: undefined,
            bcs: undefined,
            crtSec: undefined,
            mucousMembrane: undefined,
          }),
        ]}
        observations={[]}
        onRecordVitals={jest.fn()}
        onOpenObservations={jest.fn()}
      />
    );
    const vitalsCard = screen.getByLabelText('Vitals');
    // Weight, CRT·MM and Pain·BCS all collapse to a dash
    expect(within(vitalsCard).getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });

  it('falls back to a generic clinician name, omits missing times, and handles unscored observations', () => {
    render(
      <WorkspaceVitalsPanel
        vitals={[makeVitals({ recordedByName: '', recordedAt: '' })]}
        observations={[{ ...observation, total: undefined, recordedByName: '', recordedAt: '' }]}
        onRecordVitals={jest.fn()}
        onOpenObservations={jest.fn()}
      />
    );
    const vitalsCard = screen.getByLabelText('Vitals');
    const vitalsStamp = within(vitalsCard).getByText(/Recorded by Clinician/);
    expect(vitalsStamp).toBeInTheDocument();
    expect(vitalsStamp.textContent).not.toContain('·');

    const obsCard = screen.getByLabelText('Observation tools');
    const obsStamp = within(obsCard).getByText(/^Recorded/);
    expect(obsStamp.textContent).toContain('Clinician');
    expect(obsStamp.textContent).not.toContain('Score');
  });

  it('renders partial pain/BCS and CRT/MM pairs when only one half is present', () => {
    render(
      <WorkspaceVitalsPanel
        vitals={[makeVitals({ bcs: undefined, mucousMembrane: undefined })]}
        observations={[]}
        onRecordVitals={jest.fn()}
        onOpenObservations={jest.fn()}
      />
    );
    const vitalsCard = screen.getByLabelText('Vitals');
    expect(within(vitalsCard).getByText('2/10 · —/9')).toBeInTheDocument();
    expect(within(vitalsCard).getByText('<2s · —')).toBeInTheDocument();
  });

  it('renders empty states when nothing is recorded', () => {
    render(
      <WorkspaceVitalsPanel
        vitals={[]}
        observations={[]}
        onRecordVitals={jest.fn()}
        onOpenObservations={jest.fn()}
      />
    );
    expect(screen.getByText('No vitals recorded yet.')).toBeInTheDocument();
    expect(screen.getByText('No observation scores yet.')).toBeInTheDocument();
  });

  it('lists observation tools with their scores', () => {
    render(
      <WorkspaceVitalsPanel
        vitals={[]}
        observations={[observation]}
        onRecordVitals={jest.fn()}
        onOpenObservations={jest.fn()}
      />
    );
    expect(screen.getByText('CSU acute pain scale')).toBeInTheDocument();
    expect(screen.getByText(/Score 1 · Elif Kaya/)).toBeInTheDocument();
  });

  it('invokes the record and observation handlers', () => {
    const onRecordVitals = jest.fn();
    const onOpenObservations = jest.fn();
    render(
      <WorkspaceVitalsPanel
        vitals={[]}
        observations={[]}
        onRecordVitals={onRecordVitals}
        onOpenObservations={onOpenObservations}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '+ Record' }));
    fireEvent.click(screen.getByRole('button', { name: '+ New' }));
    expect(onRecordVitals).toHaveBeenCalledTimes(1);
    expect(onOpenObservations).toHaveBeenCalledTimes(1);
  });

  it('hides the record affordances when recording is locked', () => {
    render(
      <WorkspaceVitalsPanel
        vitals={[makeVitals()]}
        observations={[observation]}
        onRecordVitals={jest.fn()}
        onOpenObservations={jest.fn()}
        canRecord={false}
      />
    );
    expect(screen.queryByRole('button', { name: '+ Record' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ New' })).not.toBeInTheDocument();
    // recorded data still shows
    expect(screen.getByText('96 bpm')).toBeInTheDocument();
  });
});
