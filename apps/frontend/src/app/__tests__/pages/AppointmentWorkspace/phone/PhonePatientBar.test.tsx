import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Appointment } from '@yosemite-crew/types';
import PhonePatientBar from '@/app/features/appointments/pages/AppointmentWorkspace/phone/PhonePatientBar';

const appointment = { id: 'a1', status: 'COMPLETED' } as unknown as Appointment;

describe('PhonePatientBar', () => {
  it('renders the name, status pill, signalment and a resting timer', () => {
    render(
      <PhonePatientBar
        appointment={appointment}
        companionName="Poppy"
        breed="Beagle"
        ageLabel="4 Yrs"
        weightKg={12.4}
        allergy="penicillin"
        onBack={jest.fn()}
      />
    );
    expect(screen.getByText('Poppy')).toBeInTheDocument();
    // Signalment reads breed · age · weight, with the allergy tail highlighted.
    expect(screen.getByText(/Beagle · 4 Yrs · 12.4 kg/)).toBeInTheDocument();
    expect(screen.getByText('Allergy: penicillin')).toBeInTheDocument();
    // The shared status pill renders the appointment status.
    expect(screen.getByText('Completed')).toBeInTheDocument();
    // No visit start → the timer rests rather than fabricating an elapsed value.
    expect(screen.getByTestId('visit-timer')).toHaveTextContent('Not started');
  });

  it('omits the allergy tail when there is no allergy', () => {
    render(
      <PhonePatientBar
        appointment={appointment}
        companionName="Rex"
        breed="Boxer"
        ageLabel="2 Yrs"
        onBack={jest.fn()}
      />
    );
    expect(screen.getByText('Boxer · 2 Yrs')).toBeInTheDocument();
    expect(screen.queryByText(/Allergy:/)).not.toBeInTheDocument();
  });

  it('fires the back handler', () => {
    const onBack = jest.fn();
    render(<PhonePatientBar appointment={appointment} companionName="Poppy" onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders the species avatar with the companion name as alt text', () => {
    render(
      <PhonePatientBar
        appointment={appointment}
        companionName="Poppy"
        speciesType="cat"
        onBack={jest.fn()}
      />
    );
    expect(screen.getByAltText('Poppy')).toBeInTheDocument();
  });
});
