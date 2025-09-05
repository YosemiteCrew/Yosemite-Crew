import {showToast} from '../../components/Toast';
import {makeThunk} from './thunks';

/* ===================== APPOINTMENT ===================== */
export const get_time_slots_by_date = makeThunk(
  'appointment/getTimeSlots',
  d =>
    `Slot/getTimeSlots?appointmentDate=${d?.appointmentDate}&doctorId=${d?.doctorId}`,
  {method: 'GET', showToastMessage: false},
);
export const get_time_slots_by_Month = makeThunk(
  'appointment/getTimeSlotsByMonth',
  d =>
    `Slot/getTimeSlotsByMonth?slotYear=${d?.slotYear}&doctorId=${d?.doctorId}&slotMonth=${d?.slotMonth}`,
  {method: 'GET', headers: {}, showToastMessage: false},
);
export const book_appointment_api = makeThunk(
  'appointment/bookAppointment',
  'bookAppointment',
  {
    method: 'POST',
    multiPart: true,
  },
);
export const hospitals_centers_list = makeThunk(
  'appointment/getLists',
  d =>
    `Organization/getLists?type=${d?.type}&limit=${d?.limit}&offset=${d?.offset}`,
  {method: 'GET', showToastMessage: false},
);
export const doctors_by_departments = makeThunk(
  'appointment/getDoctorsLists',
  'getDoctorsLists',
  {method: 'POST'},
);
export const get_appointment_list = makeThunk(
  'appointment/getappointments',
  d => `getappointments?type=${d?.type}&limit=${d?.limit}&offset=${d?.offset}`,
  {method: 'GET', showToastMessage: false},
);
export const get_appointment_reasons_list = makeThunk(
  'appointment/admin/AppointmentType',
  'admin/AppointmentType',
  {method: 'GET'},
);

export const get_doctor_count_by_department = makeThunk(
  'Practitioner/getDoctorCountByDepartmentWise',
  d => `Practitioner/getDoctorCountByDepartmentWise?cognitoId=${d?.businessId}`,
  {method: 'GET', showToastMessage: false},
);

export const cancel_appointment = makeThunk(
  'cancelappointment/appointmentID',
  d => `cancelappointment?appointmentID=${d?.appointmentId}`,
  {method: 'PUT'},
);

export const reschedule_appointment = makeThunk(
  'appopintment/rescheduleAppointment',
  d => `rescheduleAppointment?appointmentID=${d?.appointmentID}`,
  {
    method: 'PUT',
    multiPart: true,
    transformBody: d => d.api_credentials,
  },
);
