import React, {forwardRef, useImperativeHandle, useMemo, useRef, useState} from 'react';
import ConfirmActionBottomSheet, {
  type ConfirmActionBottomSheetRef,
} from '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet';
import {useTheme} from '@/hooks';

export interface CancelAppointmentBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface Props {
  onConfirm: () => Promise<void> | void;
  onCancel?: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export const CancelAppointmentBottomSheet = forwardRef<CancelAppointmentBottomSheetRef, Props>(
  (
    {
      onConfirm,
      onCancel,
      title = 'Cancel appointment',
      message = 'Are you sure you want to cancel this appointment?',
      confirmLabel = 'Cancel appointment',
      cancelLabel = 'Keep appointment',
    },
    ref,
  ) => {
    const {theme} = useTheme();
    const sheetRef = useRef<ConfirmActionBottomSheetRef>(null);
    const [isLoading, setIsLoading] = useState(false);

    useImperativeHandle(ref, () => ({
      open: () => sheetRef.current?.open(),
      close: () => sheetRef.current?.close(),
    }));

    const handleConfirm = async () => {
      setIsLoading(true);
      try {
        await onConfirm();
        sheetRef.current?.close();
      } catch (error) {
        console.warn('[CancelAppointmentBottomSheet] confirm failed', error);
      } finally {
        setIsLoading(false);
      }
    };

    const handleCancel = () => {
      onCancel?.();
      sheetRef.current?.close();
    };

    const buttonStyles = useMemo(() => ({
      cancelText: theme.typography.buttonH6Clash19,
      confirmText: theme.typography.buttonH6Clash19,
    }), [theme.typography]);

    return (
      <ConfirmActionBottomSheet
        ref={sheetRef}
        title={title}
        message={message}
        primaryButton={{
          label: isLoading ? 'Cancelling...' : confirmLabel,
          onPress: handleConfirm,
          tintColor: theme.colors.secondary,
          textStyle: [buttonStyles.confirmText, {color: theme.colors.white}],
          style: {flex: 1},
          disabled: isLoading,
          loading: isLoading,
        }}
        secondaryButton={{
          label: cancelLabel,
          onPress: handleCancel,
          tintColor: theme.colors.surface,
          textStyle: [buttonStyles.cancelText, {color: theme.colors.secondary}],
          style: {flex: 1, borderWidth: 1, borderColor: theme.colors.borderMuted},
          forceBorder: true,
          borderColor: theme.colors.borderMuted,
          disabled: isLoading,
        }}
      />
    );
  },
);

CancelAppointmentBottomSheet.displayName = 'CancelAppointmentBottomSheet';

export default CancelAppointmentBottomSheet;
