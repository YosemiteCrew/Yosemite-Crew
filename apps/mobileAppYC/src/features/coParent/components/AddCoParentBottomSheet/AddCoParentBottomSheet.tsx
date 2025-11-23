import React, {forwardRef} from 'react';
import {View, StyleSheet} from 'react-native';
import {ConfirmActionBottomSheet} from '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet';
import {useTheme} from '@/hooks';
import {BottomSheetMessage} from '@/shared/components/common/BottomSheetMessage/BottomSheetMessage';
import {useConfirmActionSheetRef} from '@/shared/hooks/useConfirmActionSheetRef';

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
  const {sheetRef, handleConfirm} = useConfirmActionSheetRef(ref, onConfirm);

  return (
    <ConfirmActionBottomSheet
      ref={sheetRef}
      title="Added co-parent"
      snapPoints={['45%']}
      primaryButton={{
        label: 'Okay',
        onPress: handleConfirm,
      }}
      zIndex={200}
      onSheetChange={onSheetChange}
      containerStyle={styles.container}>
      <View>
        <BottomSheetMessage>
          We have sent a request to{' '}
          {coParentName ? (
            <BottomSheetMessage.Highlight>{coParentName}</BottomSheetMessage.Highlight>
          ) : null}
          {coParentEmail ? (
            <>
              {' at '}
              <BottomSheetMessage.Highlight>{coParentEmail}</BottomSheetMessage.Highlight>
            </>
          ) : null}
          {coParentPhone ? (
            <>
              {', mobile number '}
              <BottomSheetMessage.Highlight>{coParentPhone}</BottomSheetMessage.Highlight>
            </>
          ) : null}
          {' as a co-parent.'}
        </BottomSheetMessage>
      </View>
    </ConfirmActionBottomSheet>
  );
});

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      gap: theme.spacing[4],
    },
  });

export default AddCoParentBottomSheet;
