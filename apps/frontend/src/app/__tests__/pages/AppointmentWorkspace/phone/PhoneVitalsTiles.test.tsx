import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PhoneVitalsTiles from '@/app/features/appointments/pages/AppointmentWorkspace/phone/PhoneVitalsTiles';
import type { Vitals } from '@/app/features/appointments/types/workspace';

const vitals: Vitals = {
  id: 'v1',
  code: 'VITALS',
  tempF: 101.2,
  heartRateBpm: 96,
  respRateBpm: 24,
  recordedByName: 'Dr Weber',
  recordedAt: '2026-07-10T09:00:00.000Z',
};

describe('PhoneVitalsTiles', () => {
  it('renders a Celsius temperature in Celsius', () => {
    // The phone tile is the twin of the desktop rail's Temp cell and had the same
    // hard-coded '°F'; fixing one surface without the other leaves the bug on phone.
    render(
      <PhoneVitalsTiles
        weightKg={12.4}
        latestVitals={{ ...vitals, tempF: undefined, tempC: 38.5 }}
      />
    );
    expect(screen.getByText('38.5 °C')).toBeInTheDocument();
    expect(screen.queryByText('38.5 °F')).not.toBeInTheDocument();
  });

  it('renders weight, temp and combined HR · RR from the latest vitals', () => {
    render(<PhoneVitalsTiles weightKg={12.4} latestVitals={vitals} />);
    expect(screen.getByText('Weight')).toBeInTheDocument();
    expect(screen.getByText('12.4 kg')).toBeInTheDocument();
    expect(screen.getByText('Temp')).toBeInTheDocument();
    expect(screen.getByText('101.2 °F')).toBeInTheDocument();
    expect(screen.getByText('HR · RR')).toBeInTheDocument();
    expect(screen.getByText('96 · 24')).toBeInTheDocument();
  });

  it('falls back to an em dash for every missing value', () => {
    render(<PhoneVitalsTiles />);
    expect(screen.getAllByText('—')).toHaveLength(3);
  });

  it('renders a partial HR · RR when only one of the two is present', () => {
    render(
      <PhoneVitalsTiles latestVitals={{ ...vitals, heartRateBpm: 88, respRateBpm: undefined }} />
    );
    expect(screen.getByText('88 · —')).toBeInTheDocument();
  });

  it('dashes only the heart rate when respiratory rate is present', () => {
    render(
      <PhoneVitalsTiles latestVitals={{ ...vitals, heartRateBpm: undefined, respRateBpm: 24 }} />
    );
    expect(screen.getByText('— · 24')).toBeInTheDocument();
  });
});
