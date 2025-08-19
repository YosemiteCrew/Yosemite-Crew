import {showToast} from '../../components/Toast';
import {makeThunk} from './thunks';

/* ===================== APPOINTMENT ===================== */
export const get_time_slots_by_date = makeThunk(
  'appointment/getTimeSlots',
  'Slot/getTimeSlots',
  {method: 'GET'},
);
export const get_time_slots_by_Month = makeThunk(
  'appointment/getTimeSlotsByMonth',
  'Slot/getTimeSlotsByMonth',
  {method: 'GET', headers: {}},
);
export const book_appointment_api = makeThunk(
  'appointment/bookAppointment',
  'bookAppointment',
  {
    method: 'POST',
    multiPart: true,
    onSuccess: res => showToast(res?.data?.status, res?.data?.message),
  },
);
export const hospitals_centers_list = makeThunk(
  'appointment/getLists',
  'Organization/getLists',
  {method: 'GET'},
);
export const doctors_by_departments = makeThunk(
  'appointment/getDoctorsLists',
  'getDoctorsLists',
  {method: 'POST'},
);
export const get_appointment_list = makeThunk(
  'appointment/getappointments',
  'getappointments',
  {method: 'GET', showToastMessage: false},
);
export const get_appointment_reasons_list = makeThunk(
  'appointment/admin/AppointmentType',
  'admin/AppointmentType',
  {method: 'GET'},
);
