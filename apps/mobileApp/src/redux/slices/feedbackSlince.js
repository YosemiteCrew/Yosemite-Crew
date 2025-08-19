import {makeThunk} from './thunks';

/* ===================== FEEDBACK ===================== */
export const get_feedback_list = makeThunk(
  'Observation/getFeedBack',
  'Observation/getFeedBack',
  {method: 'GET'},
);
export const save_a_feedback = makeThunk(
  'Observation/saveFeedBack',
  'Observation/saveFeedBack',
  {method: 'POST', multiPart: true},
);
export const update_a_feedback = makeThunk(
  'Observation/editFeedBack',
  d => `Observation/editFeedBack?feedbackId=${d?.feedBackId}`,
  {method: 'PUT', multiPart: true, bodyKey: 'fhirData'},
);
export const delete_a_feedback = makeThunk(
  'Observation/deleteFeedBack',
  d => `Observation/deleteFeedBack?feedbackId=${d?.feedBackId}`,
  {method: 'DELETE'},
);
