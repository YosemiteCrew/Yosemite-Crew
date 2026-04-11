import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import Plan from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Plan';
import {
  addLineItemsToAppointments,
  loadInvoicesForOrgPrimaryOrg,
} from '@/app/features/billing/services/invoiceService';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';

jest.mock('@/app/features/billing/services/invoiceService', () => ({
  addLineItemsToAppointments: jest.fn(),
  loadInvoicesForOrgPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/hooks/useBilling', () => ({
  useCurrencyForPrimaryOrg: jest.fn(),
}));

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/PrescriptionFormSection',
  () => ({
    __esModule: true,
    default: ({ onAfterCreate }: any) => (
      <div>
        <button
          type="button"
          onClick={async () => {
            await onAfterCreate({
              rawCreated: {
                answers: {
                  medications_med_1_name: 'Amoxicillin',
                  medications_med_1_price: '12.5',
                },
              },
            });
          }}
        >
          create-with-medication
        </button>
        <button
          type="button"
          onClick={async () => {
            await onAfterCreate({ rawCreated: { answers: {} } });
          }}
        >
          create-empty
        </button>
      </div>
    ),
  })
);

describe('Plan section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useCurrencyForPrimaryOrg as jest.Mock).mockReturnValue('USD');
    (addLineItemsToAppointments as jest.Mock).mockResolvedValue(undefined);
    (loadInvoicesForOrgPrimaryOrg as jest.Mock).mockResolvedValue(undefined);
  });

  it('creates invoice line items from medication plan answers', async () => {
    render(
      <Plan
        formData={{} as any}
        setFormData={jest.fn()}
        activeAppointment={{ id: 'appt-1' } as any}
        canEdit={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'create-with-medication' }));

    await waitFor(() => {
      expect(addLineItemsToAppointments).toHaveBeenCalledWith(
        [
          {
            name: 'Amoxicillin',
            quantity: 1,
            unitPrice: 12.5,
            total: 12.5,
          },
        ],
        'appt-1',
        'USD'
      );
    });
    expect(loadInvoicesForOrgPrimaryOrg).toHaveBeenCalledWith({ force: true });
  });

  it('skips billing calls when no medication items were produced', async () => {
    render(
      <Plan
        formData={{} as any}
        setFormData={jest.fn()}
        activeAppointment={{ id: 'appt-1' } as any}
        canEdit={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'create-empty' }));

    await waitFor(() => {
      expect(addLineItemsToAppointments).not.toHaveBeenCalled();
    });
    expect(loadInvoicesForOrgPrimaryOrg).not.toHaveBeenCalled();
  });
});
