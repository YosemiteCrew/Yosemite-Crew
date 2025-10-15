import React, {useMemo, useState} from 'react';
import {View, Text, TouchableOpacity, Image, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {Input} from '@/components/common/Input/Input';
import LiquidGlassButton from '@/components/common/LiquidGlassButton/LiquidGlassButton';

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

  if (!editing) {
    return (
      <TouchableOpacity style={styles.row} activeOpacity={0.8} onPress={startEdit}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.valueContainer}>
          <Text style={styles.value} numberOfLines={1}>
            {value || ' '}
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
          tintColor="#FFFFFF"
          shadowIntensity="light"
          forceBorder
          borderColor="rgba(0, 0, 0, 0.12)"
          height={48}
          borderRadius={14}
        />

        <LiquidGlassButton
          title="Save"
          onPress={saveEdit}
          style={styles.saveButton}
          textStyle={styles.saveButtonText}
          tintColor={theme.colors.secondary}
          shadowIntensity="medium"
          forceBorder
          borderColor="rgba(255, 255, 255, 0.35)"
          height={48}
          borderRadius={14}
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
      paddingVertical: theme.spacing[3],
      paddingHorizontal: theme.spacing[3],
    },
    label: {
      ...theme.typography.paragraphBold,
      color: theme.colors.secondary,
      flex: 1,
    },
    valueContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
      maxWidth: '60%',
    },
    value: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    rightArrow: {
      width: 16,
      height: 16,
      resizeMode: 'contain',
    },
    editContainer: {
      paddingVertical: theme.spacing['4'],
      paddingHorizontal: theme.spacing['5'],
      backgroundColor: theme.colors.background,
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
      backgroundColor: 'transparent',
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
