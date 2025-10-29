import React from 'react';
import {View} from 'react-native';
import {ViewTouchField} from './ViewField';
import {Images} from '@/assets/images';

interface ViewDateTimeRowProps {
  dateLabel: string;
  dateValue: string;
  timeLabel: string;
  timeValue: string;
  dateTimeRowStyle: any;
  dateTimeFieldStyle: any;
  calendarIconStyle: any;
  clockIconStyle: any;
}

/**
 * Reusable date/time row for TaskViewScreen
 * Eliminates ~12 lines per usage (used 3 times)
 */
export const ViewDateTimeRow: React.FC<ViewDateTimeRowProps> = ({
  dateLabel,
  dateValue,
  timeLabel,
  timeValue,
  dateTimeRowStyle,
  dateTimeFieldStyle,
  calendarIconStyle,
  clockIconStyle,
}) => (
  <View style={dateTimeRowStyle}>
    <ViewTouchField
      label={dateLabel}
      value={dateValue}
      icon={Images.calendarIcon}
      iconStyle={calendarIconStyle}
      fieldGroupStyle={dateTimeFieldStyle}
    />
    <ViewTouchField
      label={timeLabel}
      value={timeValue}
      icon={Images.clockIcon}
      iconStyle={clockIconStyle}
      fieldGroupStyle={dateTimeFieldStyle}
    />
  </View>
);
