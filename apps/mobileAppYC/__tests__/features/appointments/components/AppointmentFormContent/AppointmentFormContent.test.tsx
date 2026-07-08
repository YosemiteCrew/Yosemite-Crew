import React from 'react';
import {mockTheme} from '../../../setup/mockTheme';
import {render, fireEvent} from '@testing-library/react-native';
import {AppointmentFormContent} from '@/features/appointments/components/AppointmentFormContent/AppointmentFormContent';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

const mockBookingSummaryCard = jest.fn();
jest.mock(
  '@/features/appointments/components/BookingSummaryCard/BookingSummaryCard',
  () => {
    const {View} = require('react-native');
    return {
      BookingSummaryCard: (props: any) => {
        mockBookingSummaryCard(props);
        return <View testID={`summary-card-${props.title}`} />;
      },
    };
  },
);

jest.mock(
  '@/shared/components/common/CompanionSelector/CompanionSelector',
  () => {
    const {View} = require('react-native');
    return {
      CompanionSelector: (props: any) => (
        <View testID="companion-selector" {...props} />
      ),
    };
  },
);

jest.mock(
  '@/features/appointments/components/CalendarMonthStrip/CalendarMonthStrip',
  () => {
    const {View, TouchableOpacity} = require('react-native');
    return {
      __esModule: true,
      default: (props: any) => (
        <View testID="calendar-month-strip">
          <TouchableOpacity
            testID="trigger-date-change"
            onPress={() => props.onChange(new Date('2024-06-15T00:00:00.000Z'))}
          />
        </View>
      ),
    };
  },
);

jest.mock(
  '@/features/appointments/components/TimeSlotPills/TimeSlotPills',
  () => {
    const {View} = require('react-native');
    return {
      __esModule: true,
      default: (props: any) => <View testID="time-slot-pills" {...props} />,
    };
  },
);

jest.mock('@/shared/components/common/Input/Input', () => {
  const {TextInput} = require('react-native');
  return {
    Input: (props: any) => (
      <TextInput
        testID={`input-${props.label}`}
        value={props.value}
        editable={props.editable}
        onChangeText={props.onChangeText}
      />
    ),
  };
});

jest.mock('@/shared/components/common/Checkbox/Checkbox', () => {
  const {TouchableOpacity} = require('react-native');
  return {
    Checkbox: (props: any) => (
      <TouchableOpacity
        testID={props.label ? `checkbox-${props.label}` : 'checkbox-emergency'}
        onPress={() => props.onValueChange(!props.value)}
      />
    ),
  };
});

jest.mock('@/features/documents/components/DocumentAttachmentsSection', () => {
  const {View} = require('react-native');
  return {
    DocumentAttachmentsSection: (props: any) => {
      (global as any).__lastDocumentAttachmentsProps = props;
      return <View testID="document-attachments-section" />;
    },
  };
});

describe('AppointmentFormContent', () => {
  const baseProps = {
    companions: [{id: 'c1', name: 'Rex'}] as any,
    selectedCompanionId: 'c1',
    onSelectCompanion: jest.fn(),
    selectedDate: new Date('2024-06-10T00:00:00.000Z'),
    todayISO: '2024-06-10',
    onDateChange: jest.fn(),
    dateMarkers: new Set<string>(),
    slots: ['09:00', '10:00'],
    selectedSlot: '09:00',
    onSelectSlot: jest.fn(),
    emptySlotsMessage: 'No slots available',
    appointmentType: 'Cardiology',
    allowTypeEdit: false,
    concern: 'Limping',
    onConcernChange: jest.fn(),
    showEmergency: false,
    emergency: false,
    onEmergencyChange: jest.fn(),
    emergencyMessage: 'This is an emergency',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete (global as any).__lastDocumentAttachmentsProps;
  });

  it('does not render summary cards when none are provided', () => {
    const {queryByTestId} = render(<AppointmentFormContent {...baseProps} />);
    expect(mockBookingSummaryCard).not.toHaveBeenCalled();
    expect(queryByTestId(/summary-card-/)).toBeNull();
  });

  it('renders business, service, and employee cards when provided', () => {
    render(
      <AppointmentFormContent
        {...baseProps}
        businessCard={{title: 'Biz Card'}}
        serviceCard={{title: 'Service Card'}}
        employeeCard={{title: 'Employee Card'}}
      />,
    );

    expect(mockBookingSummaryCard).toHaveBeenCalledTimes(3);
  });

  it('passes badgeText null fallback and undefined subtitle fallbacks for the business card', () => {
    render(
      <AppointmentFormContent
        {...baseProps}
        businessCard={{title: 'Biz Card'}}
      />,
    );

    expect(mockBookingSummaryCard).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Biz Card',
        subtitlePrimary: undefined,
        subtitleSecondary: undefined,
        badgeText: null,
      }),
    );
  });

  it('rejects a date change that moves before todayISO', () => {
    const onDateChange = jest.fn();
    const {getByTestId} = render(
      <AppointmentFormContent
        {...baseProps}
        todayISO="2024-06-20"
        onDateChange={onDateChange}
      />,
    );

    // CalendarMonthStrip mock triggers onChange with 2024-06-15, which is
    // before todayISO (2024-06-20), so handleDateChange should no-op.
    fireEvent.press(getByTestId('trigger-date-change'));
    expect(onDateChange).not.toHaveBeenCalled();
  });

  it('accepts a date change on or after todayISO', () => {
    const onDateChange = jest.fn();
    const {getByTestId} = render(
      <AppointmentFormContent
        {...baseProps}
        todayISO="2024-06-01"
        onDateChange={onDateChange}
      />,
    );

    fireEvent.press(getByTestId('trigger-date-change'));
    expect(onDateChange).toHaveBeenCalledWith(
      new Date('2024-06-15T00:00:00.000Z'),
      '2024-06-15',
    );
  });

  it('shows the empty slots message when there are no slots', () => {
    const {getByText} = render(
      <AppointmentFormContent {...baseProps} slots={[]} />,
    );
    expect(getByText('No slots available')).toBeTruthy();

    const {queryByText: queryByTextWithSlots} = render(
      <AppointmentFormContent {...baseProps} />,
    );
    expect(queryByTextWithSlots('No slots available')).toBeNull();
  });

  it('disables the specialty input and its onChangeText when allowTypeEdit is false', () => {
    const {getByTestId} = render(<AppointmentFormContent {...baseProps} />);
    const input = getByTestId('input-Selected specialty');
    expect(input.props.editable).toBe(false);
    expect(input.props.onChangeText).toBeUndefined();
  });

  it('enables the specialty input and wires onTypeChange when allowTypeEdit is true', () => {
    const onTypeChange = jest.fn();
    const {getByTestId} = render(
      <AppointmentFormContent
        {...baseProps}
        allowTypeEdit
        onTypeChange={onTypeChange}
      />,
    );
    const input = getByTestId('input-Selected specialty');
    expect(input.props.editable).toBe(true);
    fireEvent.changeText(input, 'Oncology');
    expect(onTypeChange).toHaveBeenCalledWith('Oncology');
  });

  it('does not render the emergency checkbox when showEmergency is false', () => {
    const {queryByText} = render(<AppointmentFormContent {...baseProps} />);
    expect(queryByText('This is an emergency')).toBeNull();
  });

  it('renders and toggles the emergency checkbox when showEmergency is true', () => {
    const onEmergencyChange = jest.fn();
    const {getByTestId, getByText} = render(
      <AppointmentFormContent
        {...baseProps}
        showEmergency
        emergency={false}
        onEmergencyChange={onEmergencyChange}
      />,
    );
    expect(getByText('This is an emergency')).toBeTruthy();
    fireEvent.press(getByTestId('checkbox-emergency'));
    expect(onEmergencyChange).toHaveBeenCalledWith(true);
  });

  it('renders the attachments section by default with fallbacks for missing handlers', () => {
    const {getByTestId} = render(<AppointmentFormContent {...baseProps} />);
    expect(getByTestId('document-attachments-section')).toBeTruthy();

    const props = (global as any).__lastDocumentAttachmentsProps;
    expect(props.files).toEqual([]);
    expect(() => props.onAddPress()).not.toThrow();
    expect(() => props.onRequestRemove({id: 'f1'})).not.toThrow();
  });

  it('wires provided files, onAddDocuments and onRequestRemoveFile through to the attachments section', () => {
    const onAddDocuments = jest.fn();
    const onRequestRemoveFile = jest.fn();
    const files = [{id: 'f1', name: 'file.pdf'}] as any;

    render(
      <AppointmentFormContent
        {...baseProps}
        files={files}
        onAddDocuments={onAddDocuments}
        onRequestRemoveFile={onRequestRemoveFile}
      />,
    );

    const props = (global as any).__lastDocumentAttachmentsProps;
    expect(props.files).toBe(files);
    props.onAddPress();
    expect(onAddDocuments).toHaveBeenCalledTimes(1);
    props.onRequestRemove({id: 'f1'});
    expect(onRequestRemoveFile).toHaveBeenCalledWith('f1');
  });

  it('does not render the attachments section when showAttachments is false', () => {
    const {queryByTestId} = render(
      <AppointmentFormContent {...baseProps} showAttachments={false} />,
    );
    expect(queryByTestId('document-attachments-section')).toBeNull();
  });

  it('renders no agreement checkboxes when agreements is undefined', () => {
    const {queryByTestId} = render(<AppointmentFormContent {...baseProps} />);
    expect(queryByTestId(/checkbox-Agree/)).toBeNull();
  });

  it('renders agreement checkboxes and falls back to a no-op onChange when absent', () => {
    const agreementWithHandler = {
      id: 'a1',
      value: false,
      label: 'Agree to terms',
      onChange: jest.fn(),
    };
    const agreementWithoutHandler = {
      id: 'a2',
      value: false,
      label: 'Agree to policy',
    };

    const {getByTestId} = render(
      <AppointmentFormContent
        {...baseProps}
        agreements={[agreementWithHandler, agreementWithoutHandler]}
      />,
    );

    fireEvent.press(getByTestId('checkbox-Agree to terms'));
    expect(agreementWithHandler.onChange).toHaveBeenCalledWith(true);

    expect(() =>
      fireEvent.press(getByTestId('checkbox-Agree to policy')),
    ).not.toThrow();
  });

  it('does not render an actions container when actions is not provided', () => {
    const {queryByTestId} = render(<AppointmentFormContent {...baseProps} />);
    expect(queryByTestId('form-actions')).toBeNull();
  });

  it('renders provided actions', () => {
    const {Text} = require('react-native');
    const {getByText} = render(
      <AppointmentFormContent
        {...baseProps}
        actions={<Text>Submit Action</Text>}
      />,
    );
    expect(getByText('Submit Action')).toBeTruthy();
  });
});
