import React from 'react';
import {View, Image} from 'react-native';
import {Input, TouchableInput} from '@/shared/components/common';
import type {ImageSourcePropType} from 'react-native';

interface ViewFieldProps {
  label: string;
  value: string;
  multiline?: boolean;
  numberOfLines?: number;
  textAreaStyle?: any;
  fieldGroupStyle?: any;
}

interface ViewTouchFieldProps {
  label: string;
  value: string;
  icon?: ImageSourcePropType;
  iconStyle?: any;
  fieldGroupStyle?: any;
}

/**
 * Read-only Input field wrapper for TaskViewScreen
 * Eliminates repetitive <View style={styles.fieldGroup}><Input editable={false} /></View>
 */
export const ViewField: React.FC<ViewFieldProps> = ({
  label,
  value,
  multiline,
  numberOfLines,
  textAreaStyle,
  fieldGroupStyle,
}) => (
  <View style={fieldGroupStyle}>
    <Input
      label={label}
      value={value}
      editable={false}
      multiline={multiline}
      numberOfLines={numberOfLines}
      inputStyle={textAreaStyle}
    />
  </View>
);

/**
 * Read-only TouchableInput field wrapper for TaskViewScreen
 * Eliminates repetitive <View style={styles.fieldGroup}><TouchableInput onPress={() => {}} /></View>
 */
export const ViewTouchField: React.FC<ViewTouchFieldProps> = ({
  label,
  value,
  icon,
  iconStyle,
  fieldGroupStyle,
}) => (
  <View style={fieldGroupStyle}>
    <TouchableInput
      label={label}
      value={value}
      onPress={() => {}}
      rightComponent={icon ? <Image source={icon} style={iconStyle} /> : undefined}
    />
  </View>
);
