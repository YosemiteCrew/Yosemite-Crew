import React, {forwardRef} from 'react';
import {View, StyleSheet, Text} from 'react-native';
import {ConfirmActionBottomSheet, ConfirmActionBottomSheetRef} from '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet';
import {useTheme} from '@/hooks';

export interface AddCoParentBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface AddCoParentBottomSheetProps {
  coParentEmail?: string;
  coParentPhone?: string;
  coParentName?: string;
  onConfirm?: () => void;
  onSheetChange?: (index: number) => void;
}

export const AddCoParentBottomSheet = forwardRef<
  AddCoParentBottomSheetRef,
  AddCoParentBottomSheetProps
>(({coParentEmail, coParentPhone, coParentName, onConfirm, onSheetChange}, ref) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const bottomSheetRef = React.useRef<ConfirmActionBottomSheetRef>(null);

  React.useImperativeHandle(ref, () => ({
    open: () => bottomSheetRef.current?.open(),
    close: () => bottomSheetRef.current?.close(),
  }));

  const handleConfirm = () => {
    bottomSheetRef.current?.close();
    onConfirm?.();
  };

  const renderMessage = () => {
    return (
      <Text style={styles.messageText}>
        We have sent a request to{' '}
        {coParentName && <Text style={styles.highlightText}>{coParentName}</Text>}
        {coParentEmail && (
          <>
            {' at '}
            <Text style={styles.highlightText}>{coParentEmail}</Text>
          </>
        )}
        {coParentPhone && (
          <>
            {', mobile number '}
            <Text style={styles.highlightText}>{coParentPhone}</Text>
          </>
        )}
        {' as a co-parent.'}
      </Text>
    );
  };

  return (
    <ConfirmActionBottomSheet
      ref={bottomSheetRef}
      title="Added co-parent"
      snapPoints={['45%']}
      primaryButton={{
        label: 'Okay',
        onPress: handleConfirm,
      }}
      onSheetChange={onSheetChange}
      containerStyle={styles.container}>
      <View style={styles.messageContainer}>
        {renderMessage()}
      </View>
    </ConfirmActionBottomSheet>
  );
});

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      gap: theme.spacing[4],
    },
    messageContainer: {
      paddingHorizontal: theme.spacing[2],
      marginBottom: theme.spacing[2],
    },
    messageText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    highlightText: {
      color: theme.colors.secondary,
      fontWeight: '600',
    },
  });

export default AddCoParentBottomSheet;
