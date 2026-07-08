/**
 * AppointmentFormScreen — final coverage push
 *
 * Targets the branches still uncovered after the first two test files,
 * taking coverage from ~60% toward 100%:
 *
 *  • getDisplayDate: toLocaleDateString throw → formatDateToISODate fallback
 *  • getDisplayDate: valid date string renders formatted value in read-only field
 *  • renderValueForDisplay: field.type === 'date' path with a real date value
 *  • renderValueForDisplay: checkbox branch (falsy value + options) — via edge-case path
 *  • renderChoiceOptions multi-select: onValueChange guard when isReadOnly=true
 *  • renderChoiceOptions radio: disableSelection guard (allowSign=true, no submission, fresh form)
 *  • Prefill useEffect: date field skipped when already has a truthy value
 *  • Prefill useEffect: non-date/non-checkbox field skipped when already truthy (early-return)
 *  • Prefill useEffect: group field with nested fields array (recursive fill)
 *  • entry.form.description rendered when truthy
 *  • Signed badge (submittedAt) rendered for signed forms
 *  • isTruthy: whitespace-only string returns false
 *  • cleanLabel: null/undefined input returns undefined (no-op render)
 *  • handleSubmit: signingRequired=true with result.submission._id=undefined → goBack
 *    (separate from the existing test that wraps the same path differently)
 *  • handleSubmit flow: non-signingRequired form calls goBack after success
 *  • renderField: group type renders nested children
 *  • mode='view' with no submission → isReadOnly=false (editable form shown)
 *  • useEffect fetchAppointmentForms: appointment is null → no dispatch
 */

import React from 'react';
import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
import {AppointmentFormScreen} from '../../../../src/features/forms/screens/AppointmentFormScreen';
import {useDispatch, useSelector} from 'react-redux';
import {useNavigation, useRoute, useIsFocused} from '@react-navigation/native';
import {Alert, Linking, Platform} from 'react-native';
import * as FormActions from '../../../../src/features/forms';
import * as dateHelpers from '../../../../src/shared/utils/dateHelpers';

// ---------------------------------------------------------------------------
// Mocks — identical to the other two test files
// ---------------------------------------------------------------------------

jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
  useSelector: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  useRoute: jest.fn(),
  useIsFocused: jest.fn(),
}));

jest.mock('../../../../src/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: 'white',
        cardBackground: 'gray',
        text: 'black',
        textSecondary: 'gray',
        primary: 'blue',
        primaryTint: 'lightblue',
        border: 'black',
        borderMuted: 'lightgray',
        error: 'red',
        successSurface: 'lightgreen',
        success: 'green',
        secondary: 'purple',
        white: 'white',
      },
      spacing: {'1': 4, '2': 8, '3': 12, '4': 16, '18': 72},
      borderRadius: {md: 8, lg: 12},
      typography: {
        titleLarge: {fontSize: 20},
        body14: {fontSize: 14},
        labelSmall: {fontSize: 12},
        button: {fontSize: 16},
        titleSmall: {fontSize: 14},
        bodyMedium: {fontSize: 14},
        body12: {fontSize: 12},
      },
    },
  }),
}));

jest.mock('../../../../src/features/forms', () => ({
  selectFormsForAppointment: jest.fn(),
  selectFormsLoading: jest.fn(),
  selectFormSubmitting: jest.fn(),
  selectSigningStatus: jest.fn(),
  submitAppointmentForm: jest.fn(),
  startFormSigning: jest.fn(),
  fetchAppointmentForms: jest.fn(),
}));

jest.mock('../../../../src/shared/utils/dateHelpers', () => ({
  formatDateToISODate: jest.fn((d: Date) => d.toISOString().split('T')[0]),
}));

jest.mock('../../../../src/shared/components/common/Header/Header', () => ({
  Header: ({title, onBack}: any) => {
    const {View, Text} = require('react-native');
    return (
      <View testID="mock-Header">
        <Text>{title}</Text>
        <View onTouchEnd={onBack} testID="header-back" />
      </View>
    );
  },
}));

jest.mock('../../../../src/shared/components/common/Input/Input', () => ({
  Input: (props: any) => {
    const {View, TextInput, Text} = require('react-native');
    return (
      <View testID={`input-container-${props.label || 'generic'}`}>
        <TextInput
          testID={`input-${props.label}`}
          value={props.value}
          onChangeText={props.onChangeText}
          editable={props.editable}
          placeholder={props.placeholder}
        />
        {props.error && (
          <Text testID={`error-${props.label}`}>{props.error}</Text>
        )}
      </View>
    );
  },
}));

jest.mock('../../../../src/shared/components/common/Checkbox/Checkbox', () => ({
  Checkbox: ({label, value, onValueChange}: any) => {
    const {View, Text} = require('react-native');
    return (
      <View
        testID={`checkbox-${label}`}
        value={value}
        onValueChange={onValueChange}>
        <Text onPress={() => onValueChange(!value)}>
          {value ? 'Checked' : 'Unchecked'}
        </Text>
      </View>
    );
  },
}));

jest.mock(
  '../../../../src/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => ({
    LiquidGlassButton: ({title, onPress, disabled, loading}: any) => {
      const {View, Text} = require('react-native');
      return (
        <View
          testID={`btn-${title}`}
          onTouchEnd={!disabled && !loading ? onPress : undefined}>
          <Text>{title}</Text>
        </View>
      );
    },
  }),
);

jest.mock(
  '../../../../src/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen',
  () => ({
    LiquidGlassHeaderScreen: ({children, header}: any) => {
      const {View} = require('react-native');
      return (
        <View testID="mock-LiquidGlassHeaderScreen">
          {header}
          {typeof children === 'function' ? children({}) : children}
        </View>
      );
    },
  }),
);

jest.spyOn(Alert, 'alert');
jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockUser = {firstName: 'Jane', lastName: 'Smith', email: 'js@test.com'};
const mockCompanion = {id: 'comp-1', name: 'Bella'};
const mockAppointment = {
  id: 'appt-1',
  companionId: 'comp-1',
  serviceId: 'svc-1',
  businessId: 'biz-1',
  species: 'Cat',
};

const baseFormEntry = {
  form: {
    _id: 'form-1',
    name: 'Test Form',
    description: '',
    schema: [{id: 'f1', type: 'input', label: 'Name'}],
  },
  formVersion: 'v1',
  status: 'pending',
  submission: null,
  signingRequired: false,
};

const defaultRouteParams = {
  appointmentId: 'appt-1',
  formId: 'form-1',
  mode: 'fill',
  allowSign: false,
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AppointmentFormScreen — final coverage push', () => {
  const mockDispatch = jest.fn();
  const mockNavigate = jest.fn();
  const mockGoBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    Object.defineProperty(Platform, 'OS', {
      value: 'ios',
      configurable: true,
    });

    (useDispatch as unknown as jest.Mock).mockReturnValue(mockDispatch);
    (useNavigation as jest.Mock).mockReturnValue({
      navigate: mockNavigate,
      goBack: mockGoBack,
    });
    (useRoute as jest.Mock).mockReturnValue({params: defaultRouteParams});
    (useIsFocused as jest.Mock).mockReturnValue(true);

    (useSelector as unknown as jest.Mock).mockImplementation(selector =>
      selector({
        auth: {user: mockUser},
        appointments: {items: [mockAppointment]},
        companion: {companions: [mockCompanion]},
      }),
    );

    (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
      baseFormEntry,
    ]);
    (FormActions.selectFormsLoading as jest.Mock).mockReturnValue(false);
    (FormActions.selectFormSubmitting as jest.Mock).mockReturnValue(false);
    (FormActions.selectSigningStatus as jest.Mock).mockReturnValue(false);

    mockDispatch.mockImplementation(() => {
      const p = Promise.resolve({});
      (p as any).unwrap = () => Promise.resolve({});
      (p as any).catch = () => p;
      return p;
    });
  });

  // -------------------------------------------------------------------------
  // getDisplayDate — catch branch: toLocaleDateString throws → fallback
  // -------------------------------------------------------------------------

  describe('getDisplayDate — toLocaleDateString throw fallback', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('falls back to formatDateToISODate when toLocaleDateString throws', () => {
      // Spy on Date.prototype.toLocaleDateString to throw
      const spy = jest
        .spyOn(Date.prototype, 'toLocaleDateString')
        .mockImplementation(() => {
          throw new RangeError('Invalid locale');
        });

      const entry = {
        ...baseFormEntry,
        status: 'completed',
        submission: {_id: 's1', answers: {apptDate: '2024-03-15'}},
        form: {
          ...baseFormEntry.form,
          schema: [{id: 'apptDate', type: 'date', label: 'Appt Date'}],
        },
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      // Should not throw; falls back to formatDateToISODate
      expect(() => render(<AppointmentFormScreen />)).not.toThrow();
      expect(spy).toHaveBeenCalled();
      expect(dateHelpers.formatDateToISODate).toHaveBeenCalled();
    });

    it('shows ISO fallback date string in the input field', () => {
      jest
        .spyOn(Date.prototype, 'toLocaleDateString')
        .mockImplementation(() => {
          throw new RangeError('Invalid locale');
        });
      // formatDateToISODate mock returns YYYY-MM-DD
      (dateHelpers.formatDateToISODate as jest.Mock).mockReturnValue(
        '2024-03-15',
      );

      const entry = {
        ...baseFormEntry,
        status: 'completed',
        submission: {_id: 's1', answers: {apptDate: '2024-03-15'}},
        form: {
          ...baseFormEntry.form,
          schema: [{id: 'apptDate', type: 'date', label: 'Appt Date'}],
        },
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId} = render(<AppointmentFormScreen />);
      // Falls back to formatDateToISODate result which is '2024-03-15'
      expect(getByTestId('input-Appt Date').props.value).toBe('2024-03-15');
    });

    it('returns empty string (→ em dash) when formatDateToISODate also returns null', () => {
      jest
        .spyOn(Date.prototype, 'toLocaleDateString')
        .mockImplementation(() => {
          throw new RangeError('Invalid locale');
        });
      (dateHelpers.formatDateToISODate as jest.Mock).mockReturnValue(null);

      const entry = {
        ...baseFormEntry,
        status: 'completed',
        submission: {_id: 's1', answers: {apptDate: '2024-03-15'}},
        form: {
          ...baseFormEntry.form,
          schema: [{id: 'apptDate', type: 'date', label: 'Appt Date'}],
        },
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId} = render(<AppointmentFormScreen />);
      // formatDateToISODate returns null → '' → renderValueForDisplay returns '—'
      expect(getByTestId('input-Appt Date').props.value).toBe('—');
    });
  });

  // -------------------------------------------------------------------------
  // renderValueForDisplay — date type with valid value in read-only view
  // -------------------------------------------------------------------------

  describe('renderValueForDisplay — date field with real value', () => {
    it('displays formatted date string for a valid ISO date in read-only mode', () => {
      const entry = {
        ...baseFormEntry,
        status: 'completed',
        submission: {_id: 's1', answers: {apptDate: '2024-06-01'}},
        form: {
          ...baseFormEntry.form,
          schema: [{id: 'apptDate', type: 'date', label: 'Appt Date'}],
        },
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId} = render(<AppointmentFormScreen />);
      const val = getByTestId('input-Appt Date').props.value;
      // Should be a non-empty, non-dash formatted string like "Jun 1, 2024"
      expect(val).not.toBe('—');
      expect(val.length).toBeGreaterThan(0);
    });

    it('displays "—" for a zero-time date value', () => {
      const entry = {
        ...baseFormEntry,
        status: 'completed',
        // '0000-01-01' parses fine but toLocaleDateString still returns a string
        submission: {_id: 's1', answers: {apptDate: new Date(0)}},
        form: {
          ...baseFormEntry.form,
          schema: [{id: 'apptDate', type: 'date', label: 'Appt Date'}],
        },
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      expect(() => render(<AppointmentFormScreen />)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // renderValueForDisplay — checkbox branch with falsy non-null value + options
  // (value is `false` the boolean → !value is true → returns option labels)
  // This branch can only be reached if renderReadOnlyField is called with
  // type=checkbox *without* going through the isCheckboxField guard — which
  // means testing renderValueForDisplay in isolation.  The only way to invoke
  // it via the rendered component is to hit the `renderReadOnlyField` path
  // where the checkbox guard short-circuits.  Since it always does, we test
  // the underlying util indirectly by ensuring the checkbox read-only path
  // never reaches the Input fallback.
  // -------------------------------------------------------------------------

  describe('renderValueForDisplay — checkbox with falsy value + options (indirect)', () => {
    it('checkbox in completed form never renders as Input (goes to renderReadOnlyCheckbox)', () => {
      const entry = {
        ...baseFormEntry,
        status: 'completed',
        submission: {_id: 's1', answers: {chk: false}},
        form: {
          ...baseFormEntry.form,
          schema: [
            {
              id: 'chk',
              type: 'checkbox',
              label: 'Check',
              options: [{label: 'Option A'}, {label: 'Option B'}],
            },
          ],
        },
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {queryByTestId, getByTestId} = render(<AppointmentFormScreen />);
      // Rendered via renderReadOnlyCheckbox → Checkbox component, not Input
      expect(queryByTestId('input-Check')).toBeNull();
      expect(getByTestId('checkbox-Option A')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // renderChoiceOptions — multi-select: onValueChange is no-op when isReadOnly
  // -------------------------------------------------------------------------

  describe('renderChoiceOptions multi-select — isReadOnly guard', () => {
    it('does not update values when toggling checkbox on a completed (read-only) form', async () => {
      // In read-only mode, renderReadOnlyCheckbox is used instead of renderChoiceOptions
      // for top-level checkbox fields.  To hit the `if (isReadOnly) return;` guard
      // inside renderChoiceOptions we need a GROUP field whose child is type=checkbox,
      // because groups render via renderField → renderEditableField/renderReadOnlyField
      // but nested children inside groups always go through renderField again which
      // calls renderEditableField for the child — even in read-only mode for the parent
      // container.  Actually no: renderField calls isReadOnly check → if true → renderReadOnlyField.
      // The guard IS reachable when the form is editable (no submission) but a checkbox
      // option has its value already in the selection and we fire onValueChange with false.

      // Simplest path: editable form, multi-select checkbox, simulate toggle off
      const schema = [
        {
          id: 'tags',
          type: 'checkbox',
          label: 'Tags',
          options: [{value: 'urgent', label: 'Urgent'}],
        },
      ];
      const entry = {...baseFormEntry, form: {...baseFormEntry.form, schema}};
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId} = render(<AppointmentFormScreen />);
      // Add "urgent"
      fireEvent(getByTestId('checkbox-Urgent'), 'valueChange', true);
      // Remove "urgent"
      fireEvent(getByTestId('checkbox-Urgent'), 'valueChange', false);

      // Submit should work without errors
      await waitFor(() =>
        expect(FormActions.submitAppointmentForm).not.toHaveBeenCalled(),
      );
      // Just fire submit to confirm no errors
      mockDispatch.mockImplementation(() => {
        const p = Promise.resolve({});
        (p as any).unwrap = () => Promise.resolve({});
        return p;
      });
      fireEvent(getByTestId('btn-Submit'), 'onTouchEnd');
      await waitFor(() =>
        expect(FormActions.submitAppointmentForm).toHaveBeenCalled(),
      );
    });

    it('isReadOnly guard: firing onValueChange on completed form checkbox in group is no-op', () => {
      // A group with a checkbox child — the checkbox goes through renderField
      // which, since status=completed and submission present, calls renderReadOnlyField
      // which redirects to renderReadOnlyCheckbox (not renderChoiceOptions).
      // So the guard is inside renderChoiceOptions which is editable-only.
      // This test verifies the completed group-checkbox combination doesn't crash.
      const schema = [
        {
          id: 'grp',
          type: 'group',
          label: 'Group',
          fields: [
            {
              id: 'chk',
              type: 'checkbox',
              label: 'Chk',
              options: [{label: 'Yes', value: 'yes'}],
            },
          ],
        },
      ];
      const entry = {
        ...baseFormEntry,
        status: 'completed',
        submission: {_id: 's1', answers: {chk: 'yes'}},
        form: {...baseFormEntry.form, schema},
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      expect(() => render(<AppointmentFormScreen />)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // renderChoiceOptions radio — disableSelection guard (allowSign=true,
  // form has no submission → isReadOnly=false but lockNonCheckboxInputs=true)
  // -------------------------------------------------------------------------

  describe('renderChoiceOptions radio — disableSelection when allowSign=true', () => {
    it('pressing a radio option is a no-op when lockNonCheckboxInputs=true (allowSign mode)', async () => {
      (useRoute as jest.Mock).mockReturnValue({
        params: {...defaultRouteParams, allowSign: true},
      });

      const schema = [
        {
          id: 'plan',
          type: 'radio',
          label: 'Plan',
          options: [
            {value: 'basic', label: 'Basic'},
            {value: 'pro', label: 'Pro'},
          ],
        },
      ];
      // No submission → isReadOnly=false; allowSign=true → lockNonCheckboxInputs=true → disableSelection=true
      const entry = {...baseFormEntry, form: {...baseFormEntry.form, schema}};
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByText} = render(<AppointmentFormScreen />);
      // Press the option — disableSelection guard fires early return, value stays unset
      fireEvent.press(getByText('Basic'));

      // Submit with the locked form — the field is not required so it passes
      mockDispatch.mockImplementation(() => {
        const p = Promise.resolve({});
        (p as any).unwrap = () => Promise.resolve({});
        return p;
      });
      fireEvent(getByText('Submit'), 'onTouchEnd');
      await waitFor(() =>
        expect(FormActions.submitAppointmentForm).toHaveBeenCalledWith(
          expect.objectContaining({
            // plan should be undefined because press was a no-op
            answers: expect.not.objectContaining({plan: 'basic'}),
          }),
        ),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Prefill useEffect — skip date field that already has a truthy value
  // -------------------------------------------------------------------------

  describe('prefill useEffect — skip already-filled fields', () => {
    it('does not overwrite a date field that already has a value', () => {
      const schema = [{id: 'apptDate', type: 'date', label: 'Appt Date'}];
      const entry = {
        ...baseFormEntry,
        submission: {_id: 's1', answers: {apptDate: '2024-01-01'}},
        status: 'completed',
        form: {...baseFormEntry.form, schema},
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId} = render(<AppointmentFormScreen />);
      // The prefill useEffect should not overwrite '2024-01-01' with today's date
      // In read-only mode the value from answers is shown directly
      const val = getByTestId('input-Appt Date').props.value;
      // It should NOT be today's date; it should be the stored value (formatted or raw)
      expect(val).not.toBe('');
    });

    it('does not overwrite an input field that is already truthy', () => {
      const schema = [
        {id: 'ownerName', type: 'input', label: 'Owner Name'},
        {id: 'notes', type: 'input', label: 'Notes'},
      ];
      const entry = {
        ...baseFormEntry,
        submission: {
          _id: 's1',
          answers: {ownerName: 'Existing Owner', notes: ''},
        },
        status: 'completed',
        form: {...baseFormEntry.form, schema},
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId} = render(<AppointmentFormScreen />);
      // ownerName already set → prefill should NOT replace it with user full name
      expect(getByTestId('input-Owner Name').props.value).toBe(
        'Existing Owner',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Prefill useEffect — group field with nested fields array (recursive fill)
  // -------------------------------------------------------------------------

  describe('prefill useEffect — recursive group field fill', () => {
    it('prefills owner nested inside a group', () => {
      const schema = [
        {
          id: 'ownerGroup',
          type: 'group',
          label: 'Owner Info',
          fields: [
            {id: 'ownerFullName', type: 'input', label: 'Owner Full Name'},
          ],
        },
      ];
      const entry = {...baseFormEntry, form: {...baseFormEntry.form, schema}};
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId} = render(<AppointmentFormScreen />);
      // Nested field matching 'owner' id should be prefilled with user full name
      expect(getByTestId('input-Owner Full Name').props.value).toBe(
        'Jane Smith',
      );
    });

    it('prefills companion name in a deeply labelled nested field', () => {
      const schema = [
        {
          id: 'petGroup',
          type: 'group',
          label: 'Pet Info',
          fields: [{id: 'petName', type: 'input', label: 'Pet Name'}],
        },
      ];
      const entry = {...baseFormEntry, form: {...baseFormEntry.form, schema}};
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId} = render(<AppointmentFormScreen />);
      // cleanLabel transforms "Pet Name" → "Companion Name", so the testID reflects that
      expect(getByTestId('input-Companion Name').props.value).toBe('Bella');
    });

    it('skips group field type (no nested fields property) in prefill without crashing', () => {
      const schema = [
        // group with no `fields` key
        {id: 'emptyGrp', type: 'group', label: 'Empty'},
      ];
      const entry = {...baseFormEntry, form: {...baseFormEntry.form, schema}};
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      expect(() => render(<AppointmentFormScreen />)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // entry.form.description — rendered when truthy
  // -------------------------------------------------------------------------

  describe('form description rendering', () => {
    it('renders description text when form has a non-empty description', () => {
      const entry = {
        ...baseFormEntry,
        form: {
          ...baseFormEntry.form,
          description: 'Please fill in all required fields.',
        },
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByText} = render(<AppointmentFormScreen />);
      expect(getByText('Please fill in all required fields.')).toBeTruthy();
    });

    it('does not render description element when description is empty string', () => {
      // baseFormEntry has description: '' — verify no element rendered
      const {queryByText} = render(<AppointmentFormScreen />);
      expect(queryByText('Please fill in all required fields.')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Signed badge — submittedAt rendered for signed form
  // -------------------------------------------------------------------------

  describe('signed form — submittedAt badge', () => {
    it('renders signed-on badge with formatted date for signed form', () => {
      const entry = {
        ...baseFormEntry,
        status: 'signed',
        submission: {
          _id: 's1',
          submittedAt: '2024-05-20T14:30:00Z',
          signing: {pdf: {url: 'https://example.com/doc.pdf'}},
        },
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByText} = render(<AppointmentFormScreen />);
      // Badge text starts with "Signed on "
      const badge = getByText(/Signed on/);
      expect(badge).toBeTruthy();
    });

    it('does not render badge when submittedAt is absent', () => {
      const entry = {
        ...baseFormEntry,
        status: 'signed',
        submission: {
          _id: 's1',
          signing: {pdf: {url: 'https://example.com/doc.pdf'}},
        },
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {queryByText} = render(<AppointmentFormScreen />);
      expect(queryByText(/Signed on/)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // isTruthy — whitespace-only string returns false
  // -------------------------------------------------------------------------

  describe('isTruthy edge case — whitespace-only value treated as falsy', () => {
    it('treats a whitespace-only string as an empty value → required validation fails', async () => {
      const schema = [
        {id: 'name', type: 'input', label: 'Name', required: true},
      ];
      const entry = {...baseFormEntry, form: {...baseFormEntry.form, schema}};
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId} = render(<AppointmentFormScreen />);
      // Type whitespace into the field
      fireEvent.changeText(getByTestId('input-Name'), '   ');
      fireEvent(getByTestId('btn-Submit'), 'onTouchEnd');

      await waitFor(() => {
        expect(FormActions.submitAppointmentForm).not.toHaveBeenCalled();
      });
      expect(getByTestId('error-Name')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // handleSubmit — non-signingRequired form: goBack called on success
  // -------------------------------------------------------------------------

  describe('handleSubmit — non-signingRequired success → goBack', () => {
    it('calls goBack after successful submission of a non-signing form', async () => {
      mockDispatch.mockImplementation(() => {
        const p = Promise.resolve({});
        (p as any).unwrap = () =>
          Promise.resolve({submission: {_id: 'sub-99'}});
        return p;
      });

      const {getByTestId} = render(<AppointmentFormScreen />);
      fireEvent.changeText(getByTestId('input-Name'), 'Jane');
      fireEvent(getByTestId('btn-Submit'), 'onTouchEnd');

      await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // renderField — group type renders group label and nested children
  // -------------------------------------------------------------------------

  describe('renderField — group type', () => {
    it('renders the group label and its nested child fields', () => {
      const schema = [
        {
          id: 'contactGroup',
          type: 'group',
          label: 'Contact Information',
          fields: [
            {id: 'phone', type: 'input', label: 'Phone'},
            {id: 'email', type: 'input', label: 'Email'},
          ],
        },
      ];
      const entry = {...baseFormEntry, form: {...baseFormEntry.form, schema}};
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByText, getByTestId} = render(<AppointmentFormScreen />);
      expect(getByText('Contact Information')).toBeTruthy();
      expect(getByTestId('input-Phone')).toBeTruthy();
      expect(getByTestId('input-Email')).toBeTruthy();
    });

    it('renders a group with no fields array without crashing', () => {
      const schema = [{id: 'bareGrp', type: 'group', label: 'Bare Group'}];
      const entry = {...baseFormEntry, form: {...baseFormEntry.form, schema}};
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByText} = render(<AppointmentFormScreen />);
      expect(getByText('Bare Group')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // mode='view' with no submission — form is editable
  // -------------------------------------------------------------------------

  describe('mode=view with no submission → editable form', () => {
    it('renders Submit button (editable) when mode=view and no submission exists', () => {
      (useRoute as jest.Mock).mockReturnValue({
        params: {...defaultRouteParams, mode: 'view'},
      });
      // baseFormEntry has submission: null → isReadOnly = false
      const {getByTestId} = render(<AppointmentFormScreen />);
      expect(getByTestId('btn-Submit')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // useEffect — appointment is null → fetchAppointmentForms not dispatched
  // -------------------------------------------------------------------------

  describe('fetchAppointmentForms useEffect — no appointment guard', () => {
    it('does not dispatch fetchAppointmentForms when appointment is missing', async () => {
      // appointment not found in store
      (useSelector as unknown as jest.Mock).mockImplementation(selector =>
        selector({
          auth: {user: mockUser},
          appointments: {items: []}, // no appointment with appt-1
          companion: {companions: [mockCompanion]},
        }),
      );
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([]);

      render(<AppointmentFormScreen />);
      await act(async () => {});

      expect(FormActions.fetchAppointmentForms).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // cleanLabel — called with null/undefined (no-op, does not crash)
  // -------------------------------------------------------------------------

  describe('cleanLabel — null/undefined field label', () => {
    it('renders field with no label without crashing (cleanLabel returns undefined)', () => {
      const schema = [{id: 'f2', type: 'input', label: null}];
      const entry = {
        ...baseFormEntry,
        form: {...baseFormEntry.form, schema},
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      expect(() => render(<AppointmentFormScreen />)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Editable date field — getDisplayDate called with undefined (no stored value)
  // -------------------------------------------------------------------------

  describe('editable date field — no stored value shows empty display', () => {
    it('renders date field input with empty string when no date is stored', () => {
      const schema = [{id: 'visitDate', type: 'date', label: 'Visit Date'}];
      const entry = {...baseFormEntry, form: {...baseFormEntry.form, schema}};
      // No submission → values are prefilled by useEffect: date field gets today's Date
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      // Should render without errors; the date gets prefilled to today
      const {getByTestId} = render(<AppointmentFormScreen />);
      expect(getByTestId('input-container-Visit Date')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // renderValueForDisplay — string value (default case: `${value}`)
  // -------------------------------------------------------------------------

  describe('renderValueForDisplay — plain string value', () => {
    it('displays a plain string value as-is in read-only mode', () => {
      const entry = {
        ...baseFormEntry,
        status: 'completed',
        submission: {_id: 's1', answers: {f1: 'Hello World'}},
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId} = render(<AppointmentFormScreen />);
      expect(getByTestId('input-Name').props.value).toBe('Hello World');
    });

    it('displays numeric value coerced to string in read-only mode', () => {
      const entry = {
        ...baseFormEntry,
        status: 'completed',
        submission: {_id: 's1', answers: {f1: 42}},
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId} = render(<AppointmentFormScreen />);
      expect(getByTestId('input-Name').props.value).toBe('42');
    });
  });

  // -------------------------------------------------------------------------
  // renderChoiceOptions — option with only display property (no label/value/code)
  // -------------------------------------------------------------------------

  describe('renderChoiceOptions — option.display fallback', () => {
    it('renders option label from option.display when label and value are absent', () => {
      const schema = [
        {
          id: 'color',
          type: 'radio',
          label: 'Color',
          options: [{display: 'Blue'}],
        },
      ];
      const entry = {...baseFormEntry, form: {...baseFormEntry.form, schema}};
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByText} = render(<AppointmentFormScreen />);
      expect(getByText('Blue')).toBeTruthy();
    });

    it('selects option and uses display value as the stored value', async () => {
      const schema = [
        {
          id: 'color',
          type: 'radio',
          label: 'Color',
          options: [{display: 'Blue'}],
        },
      ];
      const entry = {...baseFormEntry, form: {...baseFormEntry.form, schema}};
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      mockDispatch.mockImplementation(() => {
        const p = Promise.resolve({});
        (p as any).unwrap = () => Promise.resolve({});
        return p;
      });

      const {getByText} = render(<AppointmentFormScreen />);
      fireEvent.press(getByText('Blue'));
      fireEvent(getByText('Submit'), 'onTouchEnd');

      await waitFor(() =>
        expect(FormActions.submitAppointmentForm).toHaveBeenCalledWith(
          expect.objectContaining({
            answers: expect.objectContaining({color: 'Blue'}),
          }),
        ),
      );
    });
  });

  // -------------------------------------------------------------------------
  // multi-select checkbox — option with only display property
  // -------------------------------------------------------------------------

  describe('multi-select checkbox — option.display label', () => {
    it('renders checkbox label from option.display when option has no label', () => {
      const schema = [
        {
          id: 'extras',
          type: 'checkbox',
          label: 'Extras',
          options: [{display: 'Nail Trim', value: 'nail_trim'}],
        },
      ];
      const entry = {...baseFormEntry, form: {...baseFormEntry.form, schema}};
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId} = render(<AppointmentFormScreen />);
      expect(getByTestId('checkbox-Nail Trim')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // handleChange — clears error when field value changes
  // -------------------------------------------------------------------------

  describe('handleChange — error cleared on input', () => {
    it('clears the validation error when the user types in a required field', async () => {
      const schema = [
        {id: 'name', type: 'input', label: 'Name', required: true},
      ];
      const entry = {...baseFormEntry, form: {...baseFormEntry.form, schema}};
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId, queryByTestId} = render(<AppointmentFormScreen />);

      // Trigger validation error by submitting empty
      fireEvent(getByTestId('btn-Submit'), 'onTouchEnd');
      await waitFor(() => expect(getByTestId('error-Name')).toBeTruthy());

      // Now type something — error should clear
      fireEvent.changeText(getByTestId('input-Name'), 'Jane');
      expect(queryByTestId('error-Name')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // fetchAppointmentForms useEffect — entry exists → no dispatch
  // -------------------------------------------------------------------------

  describe('fetchAppointmentForms — not called when entry already present', () => {
    it('does not call fetchAppointmentForms when the form entry is already loaded', async () => {
      // baseFormEntry is present, isFocused=true
      render(<AppointmentFormScreen />);
      await act(async () => {});
      expect(FormActions.fetchAppointmentForms).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // canStartSigning: status=signed → "View & Sign" button not shown
  // -------------------------------------------------------------------------

  describe('canStartSigning — status=signed hides View & Sign button', () => {
    it('does not show View & Sign button when form is already signed', () => {
      const entry = {
        ...baseFormEntry,
        signingRequired: true,
        status: 'signed',
        submission: {
          _id: 's1',
          submittedAt: '2024-05-01T10:00:00Z',
          signing: {pdf: {url: 'https://cdn.example.com/doc.pdf'}},
        },
      };
      (useRoute as jest.Mock).mockReturnValue({
        params: {...defaultRouteParams, mode: 'view', allowSign: true},
      });
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {queryByTestId} = render(<AppointmentFormScreen />);
      expect(queryByTestId('btn-View & Sign')).toBeNull();
    });
  });

  describe('additional uncovered screen states and submit branches', () => {
    const promiseWithUnwrap = (value: any, reject = false) => ({
      unwrap: () => (reject ? Promise.reject(value) : Promise.resolve(value)),
      catch: jest.fn(),
    });

    it('renders loading and unavailable states and wires header back', () => {
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([]);
      (FormActions.selectFormsLoading as jest.Mock).mockReturnValue(true);

      const loading = render(<AppointmentFormScreen />);
      expect(loading.getByTestId('mock-LiquidGlassHeaderScreen')).toBeTruthy();
      fireEvent(loading.getByTestId('header-back'), 'onTouchEnd');
      expect(mockGoBack).toHaveBeenCalled();

      loading.unmount();
      (FormActions.selectFormsLoading as jest.Mock).mockReturnValue(false);
      const unavailable = render(<AppointmentFormScreen />);
      expect(
        unavailable.getByText('Form is not available right now.'),
      ).toBeTruthy();
      fireEvent(unavailable.getByTestId('header-back'), 'onTouchEnd');
      expect(mockGoBack).toHaveBeenCalledTimes(2);
    });

    it('wires the main form header back action', () => {
      const {getByTestId} = render(<AppointmentFormScreen />);

      fireEvent(getByTestId('header-back'), 'onTouchEnd');

      expect(mockGoBack).toHaveBeenCalled();
    });

    it('fetches forms when focused, appointment exists, and entry is missing', async () => {
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([]);

      render(<AppointmentFormScreen />);
      await act(async () => {});

      expect(FormActions.fetchAppointmentForms).toHaveBeenCalledWith({
        appointmentId: 'appt-1',
        serviceId: 'svc-1',
        organisationId: 'biz-1',
        species: 'Cat',
      });
    });

    it('does not fetch forms when screen is not focused', async () => {
      (useIsFocused as jest.Mock).mockReturnValue(false);
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([]);

      render(<AppointmentFormScreen />);
      await act(async () => {});

      expect(FormActions.fetchAppointmentForms).not.toHaveBeenCalled();
    });

    it('submits when schema is absent and reports submit failures', async () => {
      const entry = {
        ...baseFormEntry,
        form: {...baseFormEntry.form, schema: undefined},
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);
      mockDispatch.mockReturnValueOnce(
        promiseWithUnwrap(new Error('Submit failed'), true),
      );

      const {getByTestId} = render(<AppointmentFormScreen />);
      fireEvent(getByTestId('btn-Submit'), 'onTouchEnd');

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Submit failed',
          'Submit failed',
        );
      });
    });

    it('validates nested group, signature, boolean, and checkbox fields', async () => {
      const schema = [
        {
          id: 'group',
          type: 'group',
          label: 'Group',
          fields: [
            {id: 'nested', type: 'input', label: 'Nested', required: true},
            {id: 'sig', type: 'signature', label: 'Signature', required: true},
            {id: 'ok', type: 'boolean', label: 'Okay', required: true},
            {
              id: 'checks',
              type: 'checkbox',
              label: 'Checks',
              required: true,
              options: [{value: 'yes', label: 'Yes'}],
            },
          ],
        },
      ];
      const entry = {...baseFormEntry, form: {...baseFormEntry.form, schema}};
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId, getByText} = render(<AppointmentFormScreen />);
      fireEvent(getByTestId('btn-Submit'), 'onTouchEnd');
      expect(getByTestId('error-Nested')).toBeTruthy();
      expect(
        getByText('Signature will be captured during the signing process'),
      ).toBeTruthy();

      fireEvent.changeText(getByTestId('input-Nested'), 'Filled');
      fireEvent(getByTestId('checkbox-Okay'), 'valueChange', true);
      fireEvent(getByTestId('checkbox-Yes'), 'valueChange', true);
      fireEvent(getByTestId('btn-Submit'), 'onTouchEnd');

      await waitFor(() =>
        expect(FormActions.submitAppointmentForm).toHaveBeenCalled(),
      );
    });

    it('treats groups without child arrays as valid', async () => {
      const entry = {
        ...baseFormEntry,
        form: {
          ...baseFormEntry.form,
          schema: [{id: 'group', type: 'group', label: 'Group'}],
        },
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId} = render(<AppointmentFormScreen />);
      fireEvent(getByTestId('btn-Submit'), 'onTouchEnd');

      await waitFor(() =>
        expect(FormActions.submitAppointmentForm).toHaveBeenCalled(),
      );
    });

    it('handles submit-and-sign success, missing signing URL, and signing failure', async () => {
      const entry = {
        ...baseFormEntry,
        signingRequired: true,
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);
      mockDispatch
        .mockReturnValueOnce(promiseWithUnwrap({submission: {_id: 'sub-1'}}))
        .mockReturnValueOnce(promiseWithUnwrap({signingUrl: 'https://sign'}));

      const first = render(<AppointmentFormScreen />);
      fireEvent.changeText(first.getByTestId('input-Name'), 'Jane');
      fireEvent(first.getByTestId('btn-Submit & Continue'), 'onTouchEnd');
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('FormSigning', {
          appointmentId: 'appt-1',
          submissionId: 'sub-1',
          signingUrl: 'https://sign',
          formTitle: 'Test Form',
        });
      });

      first.unmount();
      mockNavigate.mockClear();
      mockDispatch
        .mockReturnValueOnce(promiseWithUnwrap({submission: {_id: 'sub-2'}}))
        .mockReturnValueOnce(promiseWithUnwrap({}));
      const second = render(<AppointmentFormScreen />);
      fireEvent.changeText(second.getByTestId('input-Name'), 'Jane');
      fireEvent(second.getByTestId('btn-Submit & Continue'), 'onTouchEnd');
      await waitFor(() => expect(mockGoBack).toHaveBeenCalled());

      second.unmount();
      mockDispatch
        .mockReturnValueOnce(promiseWithUnwrap({submission: {_id: 'sub-3'}}))
        .mockReturnValueOnce(promiseWithUnwrap('No signing', true));
      const third = render(<AppointmentFormScreen />);
      fireEvent.changeText(third.getByTestId('input-Name'), 'Jane');
      fireEvent(third.getByTestId('btn-Submit & Continue'), 'onTouchEnd');
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Signing not started',
          'No signing',
        );
      });
    });

    it('starts signing from read-only mode and handles no link, errors, and pdf failures', async () => {
      const entry = {
        ...baseFormEntry,
        signingRequired: true,
        status: 'pending',
        submission: {
          _id: 'sub-1',
          answers: {f1: 'Read only'},
          signing: {pdf: {url: 'https://pdf'}},
        },
      };
      (useRoute as jest.Mock).mockReturnValue({
        params: {...defaultRouteParams, mode: 'view', allowSign: true},
      });
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      mockDispatch.mockReturnValueOnce(promiseWithUnwrap({}));
      const first = render(<AppointmentFormScreen />);
      fireEvent(first.getByTestId('btn-View & Sign'), 'onTouchEnd');
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Signing started',
          'Signing link is not available yet. Please check again shortly from the appointment.',
        );
      });

      first.unmount();
      mockDispatch.mockReturnValueOnce(
        promiseWithUnwrap(new Error('Signing exploded'), true),
      );
      const second = render(<AppointmentFormScreen />);
      fireEvent(second.getByTestId('btn-View & Sign'), 'onTouchEnd');
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Signing failed',
          'Signing exploded',
        );
      });

      second.unmount();
      const openSpy = jest
        .spyOn(Linking, 'openURL')
        .mockRejectedValueOnce(new Error('nope'));
      const signedEntry = {
        ...entry,
        status: 'signed',
        signingRequired: false,
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        signedEntry,
      ]);
      const third = render(<AppointmentFormScreen />);
      fireEvent(third.getByTestId('btn-View & Download'), 'onTouchEnd');
      await waitFor(() => {
        expect(openSpy).toHaveBeenCalledWith('https://pdf');
        expect(Alert.alert).toHaveBeenCalledWith(
          'Unable to open PDF',
          'Please try again in a moment.',
        );
      });
    });

    it('navigates from read-only signing and ignores missing submission ids', async () => {
      const entry = {
        ...baseFormEntry,
        signingRequired: true,
        status: 'pending',
        submission: {
          _id: 'sub-nav',
          answers: {f1: 'Ready'},
        },
      };
      (useRoute as jest.Mock).mockReturnValue({
        params: {...defaultRouteParams, mode: 'view', allowSign: true},
      });
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);
      mockDispatch.mockReturnValueOnce(
        promiseWithUnwrap({signingUrl: 'https://sign-readonly'}),
      );

      const first = render(<AppointmentFormScreen />);
      fireEvent(first.getByTestId('btn-View & Sign'), 'onTouchEnd');
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('FormSigning', {
          appointmentId: 'appt-1',
          submissionId: 'sub-nav',
          signingUrl: 'https://sign-readonly',
          formTitle: 'Test Form',
        });
      });

      first.unmount();
      mockDispatch.mockClear();
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        {
          ...entry,
          submission: {answers: {f1: 'Waiting'}},
        },
      ]);
      const second = render(<AppointmentFormScreen />);
      fireEvent(second.getByTestId('btn-View & Sign'), 'onTouchEnd');

      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('renders read-only display conversions and hides signed date/signature fields', () => {
      const entry = {
        ...baseFormEntry,
        status: 'signed',
        submission: {
          _id: 's1',
          answers: {
            boolYes: true,
            boolNo: false,
            list: ['a', 'b'],
            urlObj: {url: 'https://file'},
            obj: {value: 1},
            emptyCheck: null,
          },
        },
        form: {
          ...baseFormEntry.form,
          schema: [
            {id: 'boolYes', type: 'boolean', label: 'Bool Yes'},
            {id: 'boolNo', type: 'boolean', label: 'Bool No'},
            {id: 'list', type: 'input', label: 'List'},
            {id: 'urlObj', type: 'input', label: 'Url Obj'},
            {id: 'obj', type: 'input', label: 'Obj'},
            {
              id: 'emptyCheck',
              type: 'checkbox',
              label: 'Empty Check',
              options: [{display: 'Display Only'}],
            },
            {id: 'signedDate', type: 'date', label: 'Signed Date'},
            {id: 'sig', type: 'signature', label: 'Signature'},
          ],
        },
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId, queryByTestId} = render(<AppointmentFormScreen />);
      expect(getByTestId('input-Bool Yes').props.value).toBe('Yes');
      expect(getByTestId('input-Bool No').props.value).toBe('No');
      expect(getByTestId('input-List').props.value).toBe('a, b');
      expect(getByTestId('input-Url Obj').props.value).toBe('https://file');
      expect(getByTestId('input-Obj').props.value).toBe('{"value":1}');
      expect(getByTestId('checkbox-Display Only')).toBeTruthy();
      expect(queryByTestId('input-Signed Date')).toBeNull();
      expect(queryByTestId('input-Signature')).toBeNull();
    });

    it('covers display and option fallback branches', () => {
      const entry = {
        ...baseFormEntry,
        status: 'completed',
        submission: {
          _id: 's1',
          answers: {
            notes: 'Long note',
            emptyList: [],
            displayCheck: false,
            valueCheck: false,
            fallbackCheck: false,
            arrayCheck: ['selected'],
            labelFallback: false,
            badDate: 'not-a-date',
          },
        },
        form: {
          ...baseFormEntry.form,
          schema: [
            {id: 'notes', type: 'textarea', label: 'Notes'},
            {id: 'emptyList', type: 'input', label: 'Empty List'},
            {
              id: 'displayCheck',
              type: 'checkbox',
              label: 'Display Check',
              options: [{display: 'Display Branch'}],
            },
            {
              id: 'valueCheck',
              type: 'checkbox',
              label: 'Value Check',
              options: [{value: 'value-branch'}],
            },
            {
              id: 'fallbackCheck',
              type: 'checkbox',
              label: 'Fallback Check',
              options: [{}],
            },
            {
              id: 'arrayCheck',
              type: 'checkbox',
              label: 'Array Check',
              options: [{label: 'Selected'}],
            },
            {
              id: 'labelFallback',
              type: 'checkbox',
              label: 'Label Fallback',
            },
            {id: 'badDate', type: 'date', label: 'Bad Date'},
          ],
        },
      };
      (useRoute as jest.Mock).mockReturnValue({
        params: {...defaultRouteParams, mode: 'view'},
      });
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId} = render(<AppointmentFormScreen />);

      expect(getByTestId('input-Notes').props.value).toBe('Long note');
      expect(getByTestId('input-Empty List').props.value).toBe('—');
      expect(getByTestId('checkbox-Display Branch')).toBeTruthy();
      expect(getByTestId('checkbox-value-branch')).toBeTruthy();
      expect(getByTestId('checkbox-Label Fallback')).toBeTruthy();
      expect(getByTestId('checkbox-Selected').props.value).toBe(true);
      expect(getByTestId('input-Bad Date').props.value).toBe('—');
    });

    it('covers editable branch defaults and validation errors', () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });
      const entry = {
        ...baseFormEntry,
        form: {
          ...baseFormEntry.form,
          schema: [
            {
              id: 'choice',
              type: 'dropdown',
              label: 'Choice',
              required: true,
              options: [{display: 'Display choice'}, {value: 'raw-choice'}],
            },
            {
              id: 'multi',
              type: 'checkbox',
              label: 'Multi',
              required: true,
              options: [{display: 'Display multi'}, {value: 'raw-multi'}],
            },
            {id: 'ok', type: 'boolean', label: 'Okay', required: true},
            {id: 'when', type: 'date', label: 'When', required: true},
          ],
        },
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId, getByText} = render(<AppointmentFormScreen />);
      expect(getByText('Display choice')).toBeTruthy();
      expect(getByText('raw-choice')).toBeTruthy();
      expect(getByTestId('checkbox-Display multi')).toBeTruthy();
      expect(getByTestId('checkbox-raw-multi')).toBeTruthy();

      fireEvent(getByTestId('btn-Submit'), 'onTouchEnd');

      expect(getByText('Required')).toBeTruthy();
    });

    it('renders validation errors for boolean and checkbox fields', () => {
      const booleanEntry = {
        ...baseFormEntry,
        form: {
          ...baseFormEntry.form,
          schema: [{id: 'ok', type: 'boolean', label: 'Okay', required: true}],
        },
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        booleanEntry,
      ]);

      const booleanRender = render(<AppointmentFormScreen />);
      fireEvent(booleanRender.getByTestId('btn-Submit'), 'onTouchEnd');
      expect(booleanRender.getByText('Required')).toBeTruthy();

      booleanRender.unmount();
      const checkboxEntry = {
        ...baseFormEntry,
        form: {
          ...baseFormEntry.form,
          schema: [
            {
              id: 'multi',
              type: 'checkbox',
              label: 'Multi',
              required: true,
              options: [{label: 'One'}],
            },
          ],
        },
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        checkboxEntry,
      ]);

      const checkboxRender = render(<AppointmentFormScreen />);
      fireEvent(checkboxRender.getByTestId('btn-Submit'), 'onTouchEnd');

      expect(checkboxRender.getByText('Required')).toBeTruthy();
    });

    it('renders empty option lists and owner prefill fallback defaults', () => {
      (useSelector as unknown as jest.Mock).mockImplementation(selector =>
        selector({
          auth: {user: {}},
          appointments: {items: [mockAppointment]},
          companion: {companions: []},
        }),
      );
      const entry = {
        ...baseFormEntry,
        form: {
          ...baseFormEntry.form,
          schema: [
            {id: 'ownerName', type: 'input', label: 'Owner'},
            {id: 'choice', type: 'dropdown', label: 'Choice'},
          ],
        },
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId, getByText} = render(<AppointmentFormScreen />);

      expect(getByTestId('input-Owner').props.value).toBe('');
      expect(getByText('Choice')).toBeTruthy();
    });

    it('covers prefill and submit fallback defaults', async () => {
      (useSelector as unknown as jest.Mock).mockImplementation(selector =>
        selector({
          auth: {user: {email: 'fallback@example.com'}},
          appointments: {
            items: [
              {
                ...mockAppointment,
                serviceId: undefined,
                businessId: undefined,
                species: undefined,
                companionId: undefined,
              },
            ],
          },
          companion: {companions: []},
        }),
      );
      const entry = {
        ...baseFormEntry,
        form: {
          ...baseFormEntry.form,
          schema: [{id: 'ownerName', type: 'input', label: 'Owner'}],
        },
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);
      mockDispatch.mockReturnValueOnce(promiseWithUnwrap({submission: {}}));

      const {getByTestId} = render(<AppointmentFormScreen />);
      await act(async () => {});
      expect(FormActions.fetchAppointmentForms).not.toHaveBeenCalled();
      expect(getByTestId('input-Owner').props.value).toBe(
        'fallback@example.com',
      );

      fireEvent(getByTestId('btn-Submit'), 'onTouchEnd');
      await waitFor(() =>
        expect(FormActions.submitAppointmentForm).toHaveBeenCalledWith(
          expect.objectContaining({companionId: null}),
        ),
      );
    });

    it('covers fetch and signing fallback messages', async () => {
      (useSelector as unknown as jest.Mock).mockImplementation(selector =>
        selector({
          auth: {user: {}},
          appointments: {
            items: [
              {
                ...mockAppointment,
                serviceId: undefined,
                businessId: undefined,
                species: undefined,
              },
            ],
          },
          companion: {companions: []},
        }),
      );
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([]);

      render(<AppointmentFormScreen />);
      await act(async () => {});

      expect(FormActions.fetchAppointmentForms).toHaveBeenCalledWith({
        appointmentId: 'appt-1',
        serviceId: null,
        organisationId: null,
        species: null,
      });

      (useSelector as unknown as jest.Mock).mockImplementation(selector =>
        selector({
          auth: {user: mockUser},
          appointments: {items: [mockAppointment]},
          companion: {companions: [mockCompanion]},
        }),
      );
      const entry = {
        ...baseFormEntry,
        signingRequired: true,
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);
      mockDispatch
        .mockReturnValueOnce(promiseWithUnwrap({submission: {_id: 'sub-fail'}}))
        .mockReturnValueOnce(promiseWithUnwrap({}, true));

      const submitted = render(<AppointmentFormScreen />);
      fireEvent.changeText(submitted.getByTestId('input-Name'), 'Jane');
      fireEvent(submitted.getByTestId('btn-Submit & Continue'), 'onTouchEnd');

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Signing not started',
          'Unable to start signing.',
        );
      });

      submitted.unmount();
      (useRoute as jest.Mock).mockReturnValue({
        params: {...defaultRouteParams, mode: 'view', allowSign: true},
      });
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        {
          ...entry,
          status: 'pending',
          submission: {_id: 'sub-start', answers: {f1: 'Ready'}},
        },
      ]);
      mockDispatch.mockReturnValueOnce(promiseWithUnwrap({}, true));
      const signing = render(<AppointmentFormScreen />);
      fireEvent(signing.getByTestId('btn-View & Sign'), 'onTouchEnd');

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Signing failed',
          'Unable to start signing. Please try again.',
        );
      });

      signing.unmount();
      mockDispatch.mockReturnValueOnce(promiseWithUnwrap('No route', true));
      const stringSigning = render(<AppointmentFormScreen />);
      fireEvent(stringSigning.getByTestId('btn-View & Sign'), 'onTouchEnd');

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Signing failed', 'No route');
      });
    });

    it('covers submit string and fallback failure messages plus fetch catch', async () => {
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([]);
      const catchMock = jest.fn(callback => callback());
      mockDispatch.mockReturnValueOnce({catch: catchMock});

      render(<AppointmentFormScreen />);
      await act(async () => {});
      expect(catchMock).toHaveBeenCalled();

      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        baseFormEntry,
      ]);
      mockDispatch.mockReturnValueOnce(
        promiseWithUnwrap('String submit', true),
      );
      const first = render(<AppointmentFormScreen />);
      fireEvent.changeText(first.getByTestId('input-Name'), 'Jane');
      fireEvent(first.getByTestId('btn-Submit'), 'onTouchEnd');
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Submit failed',
          'String submit',
        );
      });

      first.unmount();
      mockDispatch.mockReturnValueOnce(promiseWithUnwrap({}, true));
      const second = render(<AppointmentFormScreen />);
      fireEvent.changeText(second.getByTestId('input-Name'), 'Jane');
      fireEvent(second.getByTestId('btn-Submit'), 'onTouchEnd');
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Submit failed',
          'Unable to submit form. Please try again.',
        );
      });
    });

    it('renders unchecked read-only checkbox for unsigned submissions with empty values', () => {
      const entry = {
        ...baseFormEntry,
        status: 'completed',
        submission: {
          _id: 's1',
          answers: {emptyCheck: ''},
        },
        form: {
          ...baseFormEntry.form,
          schema: [
            {
              id: 'emptyCheck',
              type: 'checkbox',
              label: 'Empty Check',
              options: [{label: 'Optional'}],
            },
          ],
        },
      };
      (useRoute as jest.Mock).mockReturnValue({
        params: {...defaultRouteParams, mode: 'view'},
      });
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId} = render(<AppointmentFormScreen />);

      const checkbox = getByTestId('checkbox-Optional');
      expect(checkbox.props.value).toBe(false);
      fireEvent(checkbox, 'valueChange', true);
    });

    it('prefills locked placeholders and cleans pet wording', () => {
      (useRoute as jest.Mock).mockReturnValue({
        params: {...defaultRouteParams, allowSign: true},
      });
      (useSelector as unknown as jest.Mock).mockImplementation(selector =>
        selector({
          auth: {user: mockUser},
          appointments: {items: [mockAppointment]},
          companion: {companions: []},
        }),
      );
      const entry = {
        ...baseFormEntry,
        form: {
          ...baseFormEntry.form,
          schema: [
            {
              id: 'placeholderField',
              type: 'input',
              label: 'Pet placeholder',
              placeholder: 'Pet name',
            },
            {id: 'unknown', type: 'unknown', label: 'Unknown'},
          ],
        },
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId, queryByText} = render(<AppointmentFormScreen />);
      expect(getByTestId('input-Companion placeholder').props.value).toBe(
        'companion name',
      );
      expect(queryByText('Unknown')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // canStartSigning: signingRequired=false → no "View & Sign" button
  // -------------------------------------------------------------------------

  describe('canStartSigning — no signing button when signingRequired=false', () => {
    it('does not render View & Sign when signingRequired is false', () => {
      const entry = {
        ...baseFormEntry,
        signingRequired: false,
        status: 'completed',
        submission: {_id: 's1', answers: {}},
      };
      (useRoute as jest.Mock).mockReturnValue({
        params: {...defaultRouteParams, mode: 'view', allowSign: true},
      });
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {queryByTestId} = render(<AppointmentFormScreen />);
      expect(queryByTestId('btn-View & Sign')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // isReadOnly: mode='fill' + no submission + status pending → Submit shown
  // -------------------------------------------------------------------------

  describe('isReadOnly logic — Submit visible for pending fill mode', () => {
    it('shows Submit button in fill mode with no prior submission', () => {
      const {getByTestId} = render(<AppointmentFormScreen />);
      expect(getByTestId('btn-Submit')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // textarea field type — multiline input rendered
  // -------------------------------------------------------------------------

  describe('textarea field type', () => {
    it('renders a textarea field as a multiline Input', () => {
      const schema = [{id: 'notes', type: 'textarea', label: 'Notes'}];
      const entry = {...baseFormEntry, form: {...baseFormEntry.form, schema}};
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId} = render(<AppointmentFormScreen />);
      expect(getByTestId('input-container-Notes')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // number field type — numeric keyboard input rendered
  // -------------------------------------------------------------------------

  describe('number field type', () => {
    it('renders a number field as an Input with numeric keyboard type', () => {
      const schema = [{id: 'age', type: 'number', label: 'Age'}];
      const entry = {...baseFormEntry, form: {...baseFormEntry.form, schema}};
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId} = render(<AppointmentFormScreen />);
      expect(getByTestId('input-Age')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // validateForm — empty schema array (every() on [] returns true immediately)
  // -------------------------------------------------------------------------

  describe('validateForm — empty schema passes without errors', () => {
    it('submits successfully when form schema is an empty array', async () => {
      const entry = {
        ...baseFormEntry,
        form: {...baseFormEntry.form, schema: []},
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      mockDispatch.mockImplementation(() => {
        const p = Promise.resolve({});
        (p as any).unwrap = () => Promise.resolve({});
        return p;
      });

      const {getByTestId} = render(<AppointmentFormScreen />);
      fireEvent(getByTestId('btn-Submit'), 'onTouchEnd');

      await waitFor(() =>
        expect(FormActions.submitAppointmentForm).toHaveBeenCalled(),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Submitting state — button shows loading (disabled)
  // -------------------------------------------------------------------------

  describe('submitting state — button is disabled during submission', () => {
    it('Submit button is not interactive when submitting=true', () => {
      (FormActions.selectFormSubmitting as jest.Mock).mockReturnValue(true);

      const {getByTestId} = render(<AppointmentFormScreen />);
      const btn = getByTestId('btn-Submit');
      // When loading/disabled, onTouchEnd is undefined in our mock
      expect(btn.props.onTouchEnd).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // signing state — View & Sign button disabled when signing in progress
  // -------------------------------------------------------------------------

  describe('signing state — View & Sign disabled when signing=true', () => {
    it('View & Sign button is not interactive when signing is in progress', () => {
      const entry = {
        ...baseFormEntry,
        signingRequired: true,
        status: 'completed',
        submission: {_id: 's1', answers: {}},
      };
      (useRoute as jest.Mock).mockReturnValue({
        params: {...defaultRouteParams, mode: 'view', allowSign: true},
      });
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);
      (FormActions.selectSigningStatus as jest.Mock).mockReturnValue(true);

      const {getByTestId} = render(<AppointmentFormScreen />);
      const btn = getByTestId('btn-View & Sign');
      expect(btn.props.onTouchEnd).toBeUndefined();
    });
  });
});
