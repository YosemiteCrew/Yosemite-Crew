import React, {useMemo, useState} from 'react';
import {View, Text, TouchableOpacity, Image, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {Input} from '@/shared/components/common/Input/Input';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';

export type InlineEditRowProps = {
  label: string;
  value: string;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad' | 'email-address';
  multiline?: boolean;
  error?: string;
  onSave: (value: string) => void;
  onCancel?: () => void;
};

export const InlineEditRow: React.FC<InlineEditRowProps> = ({
  label,
  value,
  keyboardType = 'default',
  multiline,
  error,
  onSave,
  onCancel,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value ?? '');

  const startEdit = () => {
    setTemp(value ?? '');
    setEditing(true);
  };

  const cancelEdit = () => {
    setTemp(value ?? '');
    setEditing(false);
    onCancel?.();
  };

  const saveEdit = () => {
    onSave(temp);
    setEditing(false);
  };

  const displayValue =
    value && value.trim().length > 0 ? value : '—';

  if (!editing) {
    return (
      <TouchableOpacity style={styles.row} activeOpacity={0.8} onPress={startEdit}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.valueContainer}>
          <Text style={styles.value} numberOfLines={1}>
            {displayValue}
          </Text>
          <Image source={Images.rightArrow} style={styles.rightArrow} />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.editContainer}>
      {/* ✅ Input same as AddCompanionScreen */}
      <Input
        label={label}
        value={temp}
        onChangeText={setTemp}
        keyboardType={keyboardType}
        multiline={multiline}
        error={error}
        containerStyle={styles.inputContainer}
      />

      {/* ✅ Button row same as BreedBottomSheet */}
      <View style={styles.buttonContainer}>
        <LiquidGlassButton
          title="Cancel"
          onPress={cancelEdit}
          style={styles.cancelButton}
          textStyle={styles.cancelButtonText}
          tintColor={theme.colors.white}
          shadowIntensity="light"
          forceBorder
          borderColor={theme.colors.borderMuted}
          height={theme.spacing['12']}
          borderRadius={theme.borderRadius.md}
        />

        <LiquidGlassButton
          title="Save"
          onPress={saveEdit}
          style={styles.saveButton}
          textStyle={styles.saveButtonText}
          tintColor={theme.colors.secondary}
          shadowIntensity="medium"
          forceBorder
          borderColor={theme.colors.borderMuted}
          height={theme.spacing['12']}
          borderRadius={theme.borderRadius.md}
        />
      </View>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing['3'],
      paddingHorizontal: theme.spacing['3'],
    },
    label: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      flex: 1,
    },
    valueContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
      maxWidth: '60%',
    },
    value: {
      ...theme.typography.bodyMedium,
      color: theme.colors.secondary,
      textAlign: 'right',
    },
    rightArrow: {
      width: 16,
      height: 16,
      resizeMode: 'contain',
    },
    editContainer: {
      paddingVertical: theme.spacing['4'],
      paddingHorizontal: theme.spacing['5'],
    },
    inputContainer: {
      marginBottom: theme.spacing['5'],
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: theme.spacing['3'],
      paddingBottom: theme.spacing['2'],
    },
    cancelButton: {
      flex: 1,
    },
    cancelButtonText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.text,
    },
    saveButton: {
      flex: 1,
      backgroundColor: theme.colors.secondary,
    },
    saveButtonText: {
      color: theme.colors.white,
      ...theme.typography.paragraphBold,
    },
  });

export default InlineEditRow;
