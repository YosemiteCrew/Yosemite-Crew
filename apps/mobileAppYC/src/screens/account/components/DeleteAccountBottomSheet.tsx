import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {Text, View, StyleSheet} from 'react-native';

import ConfirmActionBottomSheet, {
  type ConfirmActionBottomSheetRef,
} from '@/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet';
import {Input} from '@/components/common/Input/Input';
import {useTheme} from '@/hooks';

export interface DeleteAccountBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface DeleteAccountBottomSheetProps {
  email?: string | null;
  onCancel?: () => void;
  onDelete: () => Promise<void> | void;
}

export const DeleteAccountBottomSheet = forwardRef<
  DeleteAccountBottomSheetRef,
  DeleteAccountBottomSheetProps
>(({email, onCancel, onDelete}, ref) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const sheetRef = useRef<ConfirmActionBottomSheetRef>(null);
  const [typedEmail, setTypedEmail] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const normalizedEmail = email?.trim().toLowerCase() ?? '';

  const resetState = () => {
    setTypedEmail('');
    setError(undefined);
  };

  useImperativeHandle(ref, () => ({
    open: () => {
      resetState();
      sheetRef.current?.open();
    },
    close: () => {
      sheetRef.current?.close();
    },
  }));

  const handleClose = () => {
    sheetRef.current?.close();
  };

  const handleCancel = () => {
    resetState();
    handleClose();
    onCancel?.();
  };

  const handleDelete = async () => {
    const normalizedTypedEmail = typedEmail.trim().toLowerCase();

    if (normalizedTypedEmail.length === 0) {
      setError('Email is required');
      return;
    }

    if (normalizedEmail && normalizedTypedEmail !== normalizedEmail) {
      setError('Email must match your account email');
      return;
    }

    setError(undefined);
    await onDelete();
    resetState();
    handleClose();
  };

  const isDeleteDisabled = (() => {
    const normalizedTypedEmail = typedEmail.trim().toLowerCase();
    if (normalizedTypedEmail.length === 0) {
      return true;
    }
    if (normalizedEmail.length === 0) {
      return false;
    }
    return normalizedTypedEmail !== normalizedEmail;
  })();

  return (
    <ConfirmActionBottomSheet
      ref={sheetRef}
      snapPoints={['60%']}
      title="Delete account"
      message="Are you sure you want to delete your account?"
      messageAlign="left"
      containerStyle={styles.container}
      titleStyle={styles.title}
      messageStyle={styles.subtitle}
      buttonContainerStyle={styles.actionsRow}
      secondaryButton={{
        label: 'Cancel',
        onPress: handleCancel,
        tintColor: theme.colors.surface,
        textStyle: styles.buttonText,
        style: styles.cancelButton,
      }}
      primaryButton={{
        label: 'Delete',
        onPress: handleDelete,
        tintColor: theme.colors.secondary,
        textStyle: styles.deleteText,
        style: styles.deleteButton,
        disabled: isDeleteDisabled,
      }}>
      <View style={styles.noteBlock}>
        <Text style={styles.noteLabel}>Note: </Text>
        <Text style={styles.noteBody}>
          If you're not the primary parent, your companion's details will still be linked to the current primary parent.
        </Text>
      </View>

      <Text style={styles.warning}>To delete account re-write your email address.</Text>

      <Input
        label="Email address"
        value={typedEmail}
        onChangeText={text => {
          setTypedEmail(text);
          if (error) {
            setError(undefined);
          }
        }}
        placeholder=""
        autoCapitalize="none"
        keyboardType="email-address"
        error={error}
      />
    </ConfirmActionBottomSheet>
  );
});

DeleteAccountBottomSheet.displayName = 'DeleteAccountBottomSheet';

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      gap: theme.spacing['4'],
      paddingHorizontal: theme.spacing['5'],
      paddingVertical: theme.spacing['6'],
    },
    title: {
      // H5 Clash Grotesk 23
      ...theme.typography.h5Clash23,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    subtitle: {
      // YC PARAGRAPH 18 Bold (left aligned)
      ...theme.typography.paragraph18Bold,
      color: theme.colors.secondary,
      textAlign: 'left',
    },
    noteBlock: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      gap: 0,
    },
    noteLabel: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.primary,
      textAlign: 'left',
    },
    noteBody: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.secondary,
      textAlign: 'left',
      flex: 1,
    },
    warning: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.error,
      textAlign: 'left',
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing['3'],
      marginTop: theme.spacing['2'],
    },
    cancelButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    deleteButton: {
      flex: 1,
    },
    buttonText: {
      // YC/H6 Clash Grotesk 19
      ...theme.typography.buttonH6Clash19,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    deleteText: {
        // YC/H6 Clash Grotesk 19
      ...theme.typography.buttonH6Clash19,
      textAlign: 'center',
      color: theme.colors.white,
    },
  });

export default DeleteAccountBottomSheet;
