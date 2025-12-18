import React, {forwardRef} from 'react';
import {View, StyleSheet} from 'react-native';
import {ConfirmActionBottomSheet} from '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet';
import {useTheme} from '@/hooks';
import {BottomSheetMessage} from '@/shared/components/common/BottomSheetMessage/BottomSheetMessage';
import {useConfirmActionSheetRef} from '@/shared/hooks/useConfirmActionSheetRef';

export interface AddBusinessBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface AddBusinessBottomSheetProps {
  businessName?: string;
  businessAddress?: string;
  onConfirm?: () => void;
  onSheetChange?: (index: number) => void;
}

export const AddBusinessBottomSheet = forwardRef<AddBusinessBottomSheetRef, AddBusinessBottomSheetProps>(
  ({businessName, businessAddress, onConfirm, onSheetChange}, ref) => {
    const {theme} = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const {sheetRef, handleConfirm} = useConfirmActionSheetRef(ref, onConfirm);

    return (
      <ConfirmActionBottomSheet
        ref={sheetRef}
        title="Business Added"
        snapPoints={['45%']}
        primaryButton={{
          label: 'Okay',
          onPress: handleConfirm,
        }}
        onSheetChange={onSheetChange}
        containerStyle={styles.container}>
        <View>
          <BottomSheetMessage>
            We invited {businessName ? (
              <BottomSheetMessage.Highlight>{businessName}</BottomSheetMessage.Highlight>
            ) : null}
            {businessAddress ? (
              <>
                {' at '}
                <BottomSheetMessage.Highlight>
                  {businessAddress}
                </BottomSheetMessage.Highlight>
              </>
            ) : null}
            {' to accept your profile.'}
          </BottomSheetMessage>
        </View>
      </ConfirmActionBottomSheet>
    );
  },
);

AddBusinessBottomSheet.displayName = 'AddBusinessBottomSheet';

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      gap: theme.spacing['4'],
    },
  });

export default AddBusinessBottomSheet;
