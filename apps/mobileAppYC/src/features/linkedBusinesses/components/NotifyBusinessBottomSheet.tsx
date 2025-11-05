import React, {forwardRef} from 'react';
import {View, StyleSheet, Text} from 'react-native';
import {ConfirmActionBottomSheet, ConfirmActionBottomSheetRef} from '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet';
import {useTheme} from '@/hooks';

export interface NotifyBusinessBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface NotifyBusinessBottomSheetProps {
  businessName?: string;
  companionName?: string;
  onConfirm?: () => void;
  onSheetChange?: (index: number) => void;
}

export const NotifyBusinessBottomSheet = forwardRef<NotifyBusinessBottomSheetRef, NotifyBusinessBottomSheetProps>(
  ({businessName, companionName, onConfirm, onSheetChange}, ref) => {
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
          Yosemite Crew have sent an Invite to{' '}
          {businessName && <Text style={styles.highlightText}>{businessName}</Text>}
          {companionName && (
            <>
              {'. You\'ll get an in-app notification once they have joined Yosemite Crew and confirmed '}
              <Text style={styles.highlightText}>{companionName}</Text>
              {' as a client.'}
            </>
          )}
        </Text>
      );
    };

    return (
      <ConfirmActionBottomSheet
        ref={bottomSheetRef}
        title="Notified!"
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
  },
);

NotifyBusinessBottomSheet.displayName = 'NotifyBusinessBottomSheet';

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

export default NotifyBusinessBottomSheet;
