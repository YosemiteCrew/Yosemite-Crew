import React, {forwardRef} from 'react';
import {View, StyleSheet} from 'react-native';
import {ConfirmActionBottomSheet} from '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet';
import {useTheme} from '@/hooks';
import {BottomSheetMessage} from '@/shared/components/common/BottomSheetMessage/BottomSheetMessage';
import {useConfirmActionSheetRef} from '@/shared/hooks/useConfirmActionSheetRef';

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
    const {sheetRef, handleConfirm} = useConfirmActionSheetRef(ref, () => {
      onConfirm?.();
    });

    return (
      <ConfirmActionBottomSheet
        ref={sheetRef}
        title="Invitation Sent!"
        snapPoints={['45%']}
        primaryButton={{
          label: 'Okay',
          onPress: handleConfirm,
        }}
        onSheetChange={onSheetChange}
        containerStyle={styles.container}>
        <View>
          <BottomSheetMessage>
            Yosemite Crew have sent an Invite to{' '}
            {businessName ? (
              <BottomSheetMessage.Highlight>{businessName}</BottomSheetMessage.Highlight>
            ) : null}
            {companionName ? (
              <>
                {". You'll get an in-app notification once they have joined Yosemite Crew and confirmed "}
                <BottomSheetMessage.Highlight>
                  {companionName}
                </BottomSheetMessage.Highlight>
                {' as a client.'}
              </>
            ) : null}
          </BottomSheetMessage>
        </View>
      </ConfirmActionBottomSheet>
    );
  },
);

NotifyBusinessBottomSheet.displayName = 'NotifyBusinessBottomSheet';

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      gap: theme.spacing['4'],
    },
  });

export default NotifyBusinessBottomSheet;
