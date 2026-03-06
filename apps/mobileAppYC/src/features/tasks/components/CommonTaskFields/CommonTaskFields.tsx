import React from 'react';
import {View, StyleSheet, Text, Image} from 'react-native';
import {useSelector} from 'react-redux';
import {Input, TouchableInput} from '@/shared/components/common';
import {selectAuthUser} from '@/features/auth/selectors';
import {Images} from '@/assets/images';
import {createIconStyles} from '@/shared/utils/iconStyles';
import type {TaskFormData, TaskFormErrors} from '@/features/tasks/types';
import {selectAcceptedCoParents} from '@/features/coParent/selectors';

interface CommonTaskFieldsProps {
  formData: TaskFormData;
  errors: TaskFormErrors;
  updateField: <K extends keyof TaskFormData>(field: K, value: TaskFormData[K]) => void;
  onOpenAssignTaskSheet: () => void;
  theme: any;
}

export const CommonTaskFields: React.FC<CommonTaskFieldsProps> = ({
  formData,
  errors,
  updateField,
  onOpenAssignTaskSheet,
  theme,
}) => {
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const iconStyles = React.useMemo(() => createIconStyles(theme), [theme]);
  const currentUser = useSelector(selectAuthUser);
  const coParents = useSelector(selectAcceptedCoParents);

  // Get the assigned user's display name
  const getAssignedUserName = (): string => {
    if (!formData.assignedTo) return '';
    const selfId = currentUser?.parentId ?? currentUser?.id;
    if (selfId && selfId === formData.assignedTo && currentUser) {
      return currentUser.firstName || currentUser.email || 'You';
    }
    const coParentMatch = coParents.find(
      cp =>
        (cp.parentId && cp.parentId === formData.assignedTo) ||
        (cp.id && cp.id === formData.assignedTo) ||
        (cp.userId && cp.userId === formData.assignedTo),
    );
    if (coParentMatch) {
      const fullName = [coParentMatch.firstName, coParentMatch.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      return fullName || coParentMatch.email || 'Co-parent';
    }
    // Fallback to ID if user not found
    return formData.assignedTo;
  };

  return (
    <View style={styles.container}>
      {/* Assign Task Field */}
      <View style={styles.fieldGroup}>
        <TouchableInput
          label={getAssignedUserName() ? 'Assign to' : undefined}
          value={getAssignedUserName()}
          placeholder="Assign to"
          onPress={onOpenAssignTaskSheet}
          rightComponent={
            <Image source={Images.dropdownIcon} style={iconStyles.dropdownIcon} />
          }
          error={errors.assignedTo}
        />
      </View>

      {/* Additional Note Field */}
      <View style={styles.fieldGroup}>
        <Input
          label="Additional note"
          value={formData.additionalNote || ''}
          onChangeText={value => updateField('additionalNote', value)}
          multiline
          numberOfLines={3}
          inputStyle={styles.textArea}
        />
        {errors.additionalNote && <Text style={styles.errorText}>{errors.additionalNote}</Text>}
      </View>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      gap: 0,
    },
    fieldGroup: {
      marginBottom: theme.spacing['4'],
      gap: theme.spacing['1'],
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    errorText: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.error,
      marginTop: 3,
      marginBottom: theme.spacing['3'],
      marginLeft: theme.spacing['1'],
    },
  });
