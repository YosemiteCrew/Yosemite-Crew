import { makeThunk } from './thunks';
import { AppointmentBookingPayload } from '@/types/api';

interface TimeSlotParams {
  appointmentDate: string;
  doctorId: string;
}
interface MonthlySlotParams {
  slotYear: number;
  slotMonth: number;
  doctorId: string;
}
interface OrgListParams {
  type: string;
  limit: number;
  offset: number;
}

export const get_time_slots_by_date = makeThunk<any, TimeSlotParams>(
  'appointment/getTimeSlots',
  d => `Slot/getTimeSlots?appointmentDate=${d.appointmentDate}&doctorId=${d.doctorId}`,
  { method: 'GET', showToastMessage: false },
);

export const get_time_slots_by_Month = makeThunk<any, MonthlySlotParams>(
  'appointment/getTimeSlotsByMonth',
  d => `Slot/getTimeSlotsByMonth?slotYear=${d.slotYear}&doctorId=${d.doctorId}&slotMonth=${d.slotMonth}`,
  { method: 'GET', headers: {}, showToastMessage: false },
);

export const book_appointment_api = makeThunk<any, AppointmentBookingPayload>(
  'appointment/bookAppointment',
  'bookAppointment',
  { method: 'POST', multiPart: true },
);

export const hospitals_centers_list = makeThunk<any, OrgListParams>(
  'appointment/getLists',
  d => `Organization/getLists?type=${d.type}&limit=${d.limit}&offset=${d.offset}`,
  { method: 'GET', showToastMessage: false },
);

export const doctors_by_departments = makeThunk<any, any>(
  'appointment/getDoctorsLists',
  'getDoctorsLists',
  { method: 'POST' },
);

export const get_appointment_list = makeThunk<any, any>(
  'appointment/getappointments',
  d => `getappointments?type=${d.type}&limit=${d.limit}&offset=${d.offset}`,
  { method: 'GET', showToastMessage: false },
);

export const get_appointment_reasons_list = makeThunk<any, void>(
  'appointment/admin/AppointmentType',
  'admin/AppointmentType',
  { method: 'GET' },
);

export const get_doctor_count_by_department = makeThunk<any, { businessId: string }>(
  'Practitioner/getDoctorCountByDepartmentWise',
  d => `Practitioner/getDoctorCountByDepartmentWise?cognitoId=${d.businessId}`,
  { method: 'GET', showToastMessage: false },
);

export const cancel_appointment = makeThunk<any, { appointmentId: string }>(
  'cancelappointment/appointmentID',
  d => `cancelappointment?appointmentID=${d.appointmentId}`,
  { method: 'PUT' },
);

export const reschedule_appointment = makeThunk<any, { appointmentID: string; api_credentials: any }>(
  'appopintment/rescheduleAppointment',
  d => `rescheduleAppointment?appointmentID=${d.appointmentID}`,
  {
    method: 'PUT',
    multiPart: true,
    transformBody: d => d.api_credentials,
  },
);