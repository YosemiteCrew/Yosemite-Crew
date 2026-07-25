import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PhoneWorkspaceActionBar from '@/app/features/appointments/pages/AppointmentWorkspace/phone/PhoneWorkspaceActionBar';

const baseHandlers = {
  onAdvance: jest.fn(),
  onRecords: jest.fn(),
  onChat: jest.fn(),
  onMore: jest.fn(),
};

describe('PhoneWorkspaceActionBar', () => {
  beforeEach(() => jest.clearAllMocks());

  it('advances to the next step by default and fires the icon actions', () => {
    render(<PhoneWorkspaceActionBar activeStep="SOAP" {...baseHandlers} />);

    // From SOAP the CTA advances to Diagnostics.
    fireEvent.click(screen.getByRole('button', { name: 'Diagnostics' }));
    expect(baseHandlers.onAdvance).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Records' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(baseHandlers.onRecords).toHaveBeenCalledTimes(1);
    expect(baseHandlers.onChat).toHaveBeenCalledTimes(1);
    expect(baseHandlers.onMore).toHaveBeenCalledTimes(1);
  });

  it('disables the advance CTA when the encounter is locked', () => {
    render(<PhoneWorkspaceActionBar activeStep="SOAP" advanceDisabled {...baseHandlers} />);
    expect(screen.getByRole('button', { name: 'Diagnostics' })).toBeDisabled();
  });

  it('prefers a step-specific primary CTA over the advance action', () => {
    const onClick = jest.fn();
    render(
      <PhoneWorkspaceActionBar
        activeStep="SUMMARY"
        primaryCta={{ label: 'Discharge', onClick }}
        {...baseHandlers}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Discharge' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(baseHandlers.onAdvance).not.toHaveBeenCalled();
  });

  it('renders no CTA on the last step when no primary CTA is supplied', () => {
    render(<PhoneWorkspaceActionBar activeStep="SUMMARY" {...baseHandlers} />);
    // Only the three icon buttons remain — there is no next step to advance to.
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});
