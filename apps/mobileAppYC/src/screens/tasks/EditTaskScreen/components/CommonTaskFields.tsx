import React from 'react';
import {View, StyleSheet, Image} from 'react-native';
import {Input, TouchableInput} from '@/components/common';
import {Images} from '@/assets/images';
import type {TaskFormData, TaskFormErrors} from '@/features/tasks/types';

interface CommonTaskFieldsProps {
  formData: TaskFormData;
  errors: TaskFormErrors;
  updateField: <K extends keyof TaskFormData>(field: K, value: TaskFormData[K]) => void;
  onOpenAssignTaskSheet: () => void;
  theme: any;
}

export const CommonTaskFields: React.FC<CommonTaskFieldsProps> = ({
  formData,
  errors: _errors,
  updateField,
  onOpenAssignTaskSheet,
  theme,
}) => {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <>
      {/* Assign Task */}
      <View style={styles.fieldGroup}>
        <TouchableInput
          label={formData.assignedTo ? 'Assign task' : undefined}
          value={formData.assignedTo ? 'Assigned' : undefined}
          placeholder="Assign task"
          onPress={onOpenAssignTaskSheet}
          rightComponent={<Image source={Images.dropdownIcon} style={styles.dropdownIcon} />}
        />
      </View>

      {/* Additional Note */}
      <View style={styles.fieldGroup}>
        <Input
          label="Additional note (optional)"
          value={formData.additionalNote}
          onChangeText={text => updateField('additionalNote', text)}
          multiline
          numberOfLines={3}
          inputStyle={styles.textArea}
        />
      </View>
    </>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    fieldGroup: {
      marginBottom: theme.spacing[6],
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    dropdownIcon: {
      width: 16,
      height: 16,
      resizeMode: 'contain',
    },
  });
