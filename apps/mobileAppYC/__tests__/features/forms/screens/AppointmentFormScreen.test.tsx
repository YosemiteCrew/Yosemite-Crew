import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {AppointmentFormScreen} from '../../../../src/features/forms/screens/AppointmentFormScreen';
import {useDispatch, useSelector} from 'react-redux';
import {useNavigation, useRoute, useIsFocused} from '@react-navigation/native';
import {Alert, Linking} from 'react-native';
import * as FormActions from '../../../../src/features/forms';

// --- Mocks ---

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

// --- UI Component Mocks ---

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
      // FIX: Pass 'value' prop to the View so we can assert it in tests
      <View testID={`checkbox-${label}`} value={value}>
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

describe('AppointmentFormScreen', () => {
  const mockDispatch = jest.fn();
  const mockNavigate = jest.fn();
  const mockGoBack = jest.fn();

  const mockAppointment = {
    id: 'appt-1',
    companionId: 'comp-1',
    serviceId: 'svc-1',
    businessId: 'biz-1',
    species: 'Dog',
  };

  const mockUser = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
  };
  const mockCompanion = {id: 'comp-1', name: 'Buddy'};

  const baseFormEntry = {
    form: {
      _id: 'form-1',
      name: 'Intake Form',
      description: 'Desc',
      schema: [{id: 'f1', type: 'input', label: 'Reason'}],
    },
    formVersion: 'v1',
    status: 'pending',
    submission: null,
    signingRequired: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useDispatch as unknown as jest.Mock).mockReturnValue(mockDispatch);
    (useNavigation as jest.Mock).mockReturnValue({
      navigate: mockNavigate,
      goBack: mockGoBack,
    });
    (useRoute as jest.Mock).mockReturnValue({
      params: {
        appointmentId: 'appt-1',
        formId: 'form-1',
        mode: 'fill',
        allowSign: false,
      },
    });
    (useIsFocused as jest.Mock).mockReturnValue(true);

    (useSelector as unknown as jest.Mock).mockImplementation(selector => {
      return selector({
        auth: {user: mockUser},
        appointments: {items: [mockAppointment]},
        companion: {companions: [mockCompanion]},
      });
    });

    (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
      baseFormEntry,
    ]);
    (FormActions.selectFormsLoading as jest.Mock).mockReturnValue(false);
    (FormActions.selectFormSubmitting as jest.Mock).mockReturnValue(false);
    (FormActions.selectSigningStatus as jest.Mock).mockReturnValue(false);

    // Mock Thunk Return Default
    mockDispatch.mockImplementation(() => {
      const p = Promise.resolve({});
      (p as any).unwrap = () => Promise.resolve({});
      return p;
    });
  });

  const renderScreen = () => render(<AppointmentFormScreen />);

  // -------------------------------------------------------------------------
  // 1. Initialization & Loading
  // -------------------------------------------------------------------------
  describe('Initialization & Loading', () => {
    it('fetches forms on mount if focused', async () => {
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([]);
      renderScreen();
      await waitFor(() => {
        expect(FormActions.fetchAppointmentForms).toHaveBeenCalled();
      });
    });

    it('renders loading state', () => {
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([]);
      (FormActions.selectFormsLoading as jest.Mock).mockReturnValue(true);
      const {getByTestId} = render(<AppointmentFormScreen />);
      expect(getByTestId('mock-LiquidGlassHeaderScreen')).toBeTruthy();
    });

    it('renders not available state', () => {
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([]);
      (FormActions.selectFormsLoading as jest.Mock).mockReturnValue(false);
      const {getByText} = renderScreen();
      expect(getByText('Form is not available right now.')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Field Rendering
  // -------------------------------------------------------------------------
  describe('Field Rendering & Interaction', () => {
    it('renders all editable field types correctly', () => {
      const complexSchema = [
        {
          id: 'g1',
          type: 'group',
          label: 'My Group',
          fields: [{id: 'sub1', type: 'input', label: 'Sub Input'}],
        },
        {id: 'f_bool', type: 'boolean', label: 'Is Valid?'},
        {
          id: 'f_radio',
          type: 'radio',
          label: 'Pick One',
          options: [{value: 'A', label: 'Option A'}],
        },
        {
          id: 'f_check',
          type: 'checkbox',
          label: 'Pick Many',
          options: [{value: 'X', label: 'Option X'}],
        },
        {id: 'f_date', type: 'date', label: 'My Date'},
        {id: 'f_sig', type: 'signature', label: 'Sign'},
        {id: 'f_num', type: 'number', label: 'Count'},
        {id: 'f_text', type: 'textarea', label: 'Long Text'},
        {id: 'f_unk', type: 'unknown', label: 'Hidden'},
      ];

      const complexEntry = {
        ...baseFormEntry,
        form: {...baseFormEntry.form, schema: complexSchema},
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        complexEntry,
      ]);

      const {getByTestId, getByText, queryByText} = renderScreen();

      expect(getByText('My Group')).toBeTruthy();
      expect(getByTestId('input-Sub Input')).toBeTruthy();
      expect(getByTestId('checkbox-Is Valid?')).toBeTruthy();
      expect(getByText('Pick One')).toBeTruthy();
      expect(getByText('Option A')).toBeTruthy();
      expect(getByText('Pick Many')).toBeTruthy();
      expect(getByTestId('checkbox-Option X')).toBeTruthy();

      // Date fields auto-fill with current date, so it won't be empty
      // Just check existence
      expect(getByTestId('input-My Date')).toBeTruthy();

      expect(getByText(/Signature will be captured/)).toBeTruthy();
      expect(getByTestId('input-Count')).toBeTruthy();
      expect(getByTestId('input-Long Text')).toBeTruthy();
      expect(queryByText('Hidden')).toBeNull();
    });

    it('handles input changes', () => {
      const schema = [
        {id: 'f1', type: 'input', label: 'Text'},
        {id: 'f2', type: 'boolean', label: 'Bool'},
        {id: 'f3', type: 'radio', label: 'Radio', options: [{value: 'A'}]},
        {id: 'f4', type: 'checkbox', label: 'Multi', options: [{value: 'X'}]},
      ];
      const entry = {...baseFormEntry, form: {...baseFormEntry.form, schema}};
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId, getByText} = renderScreen();

      fireEvent.changeText(getByTestId('input-Text'), 'Hello');
      fireEvent(getByTestId('checkbox-Bool'), 'valueChange', true);
      fireEvent.press(getByText('A'));
      fireEvent(getByTestId('checkbox-X'), 'valueChange', true);
      fireEvent(getByTestId('checkbox-X'), 'valueChange', false);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Pre-filling Logic
  // -------------------------------------------------------------------------
  describe('Pre-filling Logic', () => {
    it('prefills owner/companion fields and date', () => {
      const schema = [
        {id: 'ownerName', type: 'input', label: 'Owner'},
        {id: 'petName', type: 'input', label: 'Pet Name'},
        {id: 'today', type: 'date', label: 'Date'},
        {id: 'alreadyFilled', type: 'input', label: 'Filled'},
      ];
      const entry = {
        ...baseFormEntry,
        submission: {answers: {alreadyFilled: 'Keep Me'}},
        form: {...baseFormEntry.form, schema},
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId} = renderScreen();

      expect(getByTestId('input-Owner').props.value).toBe('John Doe');
      expect(getByTestId('input-Companion Name').props.value).toBe('Buddy');
      expect(getByTestId('input-Filled').props.value).toBe('Keep Me');
      expect(getByTestId('input-Date').props.value.length).toBeGreaterThan(0);
    });

    it('prefills placeholders when allowSign is active', () => {
      (useRoute as jest.Mock).mockReturnValue({
        params: {
          appointmentId: 'appt-1',
          formId: 'form-1',
          mode: 'fill',
          allowSign: true,
        },
      });

      const schema = [
        {
          id: 'f1',
          type: 'input',
          label: 'Locked',
          placeholder: 'prefilled val',
        },
      ];
      const entry = {...baseFormEntry, form: {...baseFormEntry.form, schema}};
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId} = renderScreen();

      expect(getByTestId('input-Locked').props.value).toBe('prefilled val');
      expect(getByTestId('input-Locked').props.editable).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Validation & Submission
  // -------------------------------------------------------------------------
  describe('Validation & Submission', () => {
    it('blocks submission on required field error', () => {
      const schema = [
        {id: 'req', type: 'input', label: 'Required Field', required: true},
      ];
      const entry = {...baseFormEntry, form: {...baseFormEntry.form, schema}};
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId} = renderScreen();
      fireEvent(getByTestId('btn-Submit'), 'onTouchEnd');

      expect(FormActions.submitAppointmentForm).not.toHaveBeenCalled();
      expect(getByTestId('error-Required Field')).toBeTruthy();
    });

    it('submits successfully', async () => {
      const {getByTestId} = renderScreen();
      fireEvent.changeText(getByTestId('input-Reason'), 'Done');
      fireEvent(getByTestId('btn-Submit'), 'onTouchEnd');

      await waitFor(() => {
        expect(FormActions.submitAppointmentForm).toHaveBeenCalled();
        expect(mockGoBack).toHaveBeenCalled();
      });
    });

    it('handles submission error alert', async () => {
      // Mock the submit action to reject
      mockDispatch.mockImplementation((action: any) => {
        // We identify the thunk call because it's a function
        if (typeof action === 'function') {
          const p = Promise.resolve({});
          (p as any).unwrap = () => Promise.reject('Network Error');
          return p;
        }
        // Default fallback for other dispatch calls (e.g. init fetch)
        const p = Promise.resolve({});
        (p as any).unwrap = () => Promise.resolve({});
        return p;
      });

      const {getByTestId} = renderScreen();
      // Must fill required field first so validation passes
      fireEvent.changeText(getByTestId('input-Reason'), 'Done');
      fireEvent(getByTestId('btn-Submit'), 'onTouchEnd');
    });

    it('triggers auto-signing after submit', async () => {
      const entry = {...baseFormEntry, signingRequired: true};
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      mockDispatch.mockImplementation(() => {
        const p = Promise.resolve({});
        (p as any).unwrap = () =>
          Promise.resolve({submission: {_id: 's1'}, signingUrl: 'http://sign'});
        return p;
      });

      const {getByTestId} = renderScreen();
      fireEvent.changeText(getByTestId('input-Reason'), 'Done');
      fireEvent(getByTestId('btn-Submit & Continue'), 'onTouchEnd');

      await waitFor(() => {
        expect(FormActions.startFormSigning).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith(
          'FormSigning',
          expect.anything(),
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // 5. Read-Only / Signed
  // -------------------------------------------------------------------------
  describe('Read Only & Signed Views', () => {
    it('renders read-only fields correctly', () => {
      const schema = [
        {id: 'f1', type: 'input', label: 'Input'},
        {id: 'f2', type: 'checkbox', label: 'Check', options: [{value: 'A'}]},
      ];
      const entry = {
        ...baseFormEntry,
        status: 'completed',
        submission: {
          _id: 's1',
          answers: {f1: 'Val', f2: ['A']},
        },
        form: {...baseFormEntry.form, schema},
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByTestId} = renderScreen();

      expect(getByTestId('input-Input').props.editable).toBe(false);
      // FIX: Verify value via props which we added to our mock Checkbox
      expect(getByTestId('checkbox-A').props.value).toBe(true);
    });

    it('shows signed badge and download button if pdf url exists', () => {
      const entry = {
        ...baseFormEntry,
        status: 'signed',
        submission: {
          _id: 's1',
          submittedAt: '2023-01-01T10:00:00Z',
          signing: {pdf: {url: 'http://pdf'}},
        },
      };
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      const {getByText, getByTestId} = renderScreen();

      expect(getByText(/Signed on/)).toBeTruthy();
      expect(getByTestId('btn-View & Download')).toBeTruthy();

      fireEvent(getByTestId('btn-View & Download'), 'onTouchEnd');
      expect(Linking.openURL).toHaveBeenCalledWith('http://pdf');
    });

    it('handles manual start signing click', async () => {
      const entry = {
        ...baseFormEntry,
        signingRequired: true,
        status: 'completed',
        submission: {_id: 's1', answers: {}},
      };
      (useRoute as jest.Mock).mockReturnValue({
        params: {
          appointmentId: 'appt-1',
          formId: 'form-1',
          mode: 'view',
          allowSign: true,
        },
      });
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        entry,
      ]);

      mockDispatch.mockImplementation(() => {
        const p = Promise.resolve({});
        (p as any).unwrap = () => Promise.resolve({signingUrl: 'http://sign'});
        return p;
      });

      const {getByTestId} = renderScreen();
      fireEvent(getByTestId('btn-View & Sign'), 'onTouchEnd');

      await waitFor(() => {
        expect(FormActions.startFormSigning).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith(
          'FormSigning',
          expect.objectContaining({signingUrl: 'http://sign'}),
        );
      });
    });
  });
});
