import { createEmptyFormData } from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/appointmentInfoTypes';

describe('createEmptyFormData', () => {
  it('returns an empty form data shape', () => {
    expect(createEmptyFormData()).toEqual({
      subjective: [],
      objective: [],
      assessment: [],
      discharge: [],
      plan: [],
      total: '',
      discount: '',
      subTotal: '',
      tax: '',
      lineItems: [],
    });
  });

  it('returns a fresh object on each call', () => {
    const first = createEmptyFormData();
    const second = createEmptyFormData();
    expect(first).not.toBe(second);
    expect(first.subjective).not.toBe(second.subjective);
  });
});
