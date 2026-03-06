import React, {forwardRef, useMemo, useRef} from 'react';
import {View, StyleSheet, Text, Image} from 'react-native';
import CustomBottomSheet, {type BottomSheetRef} from '@/shared/components/common/BottomSheet/BottomSheet';
import {BottomSheetHeader} from '@/shared/components/common/BottomSheetHeader/BottomSheetHeader';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

export interface NetworkStatusBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface NetworkStatusBottomSheetProps {
  bottomInset?: number;
}

export const NetworkStatusBottomSheet = forwardRef<
  NetworkStatusBottomSheetRef,
  NetworkStatusBottomSheetProps
>(({bottomInset}, ref) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const bottomSheetRef = useRef<BottomSheetRef>(null);
  const [isSheetVisible, setIsSheetVisible] = React.useState(false);

  React.useImperativeHandle(ref, () => ({
    open: () => {
      setIsSheetVisible(true);
      bottomSheetRef.current?.snapToIndex(0);
    },
    close: () => {
      setIsSheetVisible(false);
      bottomSheetRef.current?.close();
    },
  }));

  return (
    <CustomBottomSheet
      ref={bottomSheetRef}
      snapPoints={['50%']}
      initialIndex={-1}
      zIndex={250}
      onChange={index => {
        setIsSheetVisible(index !== -1);
      }}
      enablePanDownToClose={false}
      enableBackdrop={isSheetVisible}
      enableHandlePanningGesture={false}
      enableContentPanningGesture={false}
      backdropOpacity={0.5}
      backdropAppearsOnIndex={0}
      backdropDisappearsOnIndex={-1}
      backdropPressBehavior="none"
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.bottomSheetHandle}
      bottomInset={bottomInset}
      contentType="view">
      <View style={styles.container}>
        <BottomSheetHeader
          title="No Internet Connection"
          onClose={() => {}}
          theme={theme}
          showCloseButton={false}
        />
        {/* Offline Image Section */}
        <View style={styles.imageContainer}>
          <Image
            source={Images.offlineImage}
            style={styles.image}
            resizeMode="contain"
          />
        </View>

        {/* Message Section */}
        <View style={styles.messageContainer}>
          <Text style={styles.messageTitle}>
            Looks like you're offline...
          </Text>
          <Text style={styles.messageSubtitle}>
            Supercharge your internet to elevate your buddy's well-being!
          </Text>
        </View>
      </View>
    </CustomBottomSheet>
  );
});

const createStyles = (theme: any) =>
  StyleSheet.create({
    bottomSheetBackground: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.spacing['6'],
      borderTopRightRadius: theme.spacing['6'],
    },
    bottomSheetHandle: {
      backgroundColor: theme.colors.borderMuted,
    },
    container: {
      gap: theme.spacing['4'],
      paddingHorizontal: theme.spacing['5'],
      paddingBottom: theme.spacing['12'],
    },
    imageContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: theme.spacing['3'],
      height: 200,
    },
    image: {
      width: 200,
      height: 200,
    },
    messageContainer: {
      alignItems: 'center',
      marginVertical: theme.spacing['2'],
    },
    messageTitle: {
      ...theme.typography.titleLarge,
      color: theme.colors.secondary,
      marginBottom: theme.spacing['2'],
      textAlign: 'center',
    },
    messageSubtitle: {
      ...theme.typography.paragraph,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
  });

export default NetworkStatusBottomSheet;
