// Draft state for the vitals form, kept out of VitalsForm.tsx so that file only
// exports its component (React Doctor: only-export-components / Fast Refresh).
/**
 * A vital's key states the unit it was recorded in.
 *
 * Both scales are first-class rather than one being normalised away, because a
 * clinic enters what its template declares and a conversion on save would make
 * the stored number differ from the one the clinician typed. Exactly one of
 * each pair is ever populated for a given reading - see `resolveDraftKey`,
 * which picks by the template's declared unit.
 */
export type DraftVitals = {
  weightLbs: string;
  weightKg: string;
  tempF: string;
  tempC: string;
  heartRateBpm: string;
  respRateBpm: string;
  crtSec: string;
  mucousMembrane: string;
  painScore: string;
  bcs: string;
};

export const EMPTY_DRAFT: DraftVitals = {
  weightLbs: '',
  weightKg: '',
  tempF: '',
  tempC: '',
  heartRateBpm: '',
  respRateBpm: '',
  crtSec: '',
  mucousMembrane: '',
  painScore: '',
  bcs: '',
};

export type VitalsFormDraftState = {
  draft: DraftVitals;
  notes: string;
  creating: boolean;
};

export const INITIAL_VITALS_FORM_DRAFT_STATE: VitalsFormDraftState = {
  draft: EMPTY_DRAFT,
  notes: '',
  creating: false,
};

export type VitalsFormDraftAction =
  | { type: 'SET_FIELD'; key: keyof DraftVitals; value: string }
  | { type: 'SET_NOTES'; value: string }
  | { type: 'SET_CREATING'; value: boolean }
  | { type: 'RESET' };

// Each case returns the same state reference when nothing changed, so callers
// depending on this state can bail out via React's Object.is check instead of
// looping forever (the lesson from the StripeOnboarding OOM).
export const vitalsFormDraftReducer = (
  state: VitalsFormDraftState,
  action: VitalsFormDraftAction
): VitalsFormDraftState => {
  switch (action.type) {
    case 'SET_FIELD': {
      if (state.draft[action.key] === action.value) return state;
      return { ...state, draft: { ...state.draft, [action.key]: action.value } };
    }
    case 'SET_NOTES':
      return state.notes === action.value ? state : { ...state, notes: action.value };
    case 'SET_CREATING':
      return state.creating === action.value ? state : { ...state, creating: action.value };
    case 'RESET':
      return state.draft === EMPTY_DRAFT && state.notes === '' && !state.creating
        ? state
        : INITIAL_VITALS_FORM_DRAFT_STATE;
    default:
      return state;
  }
};
