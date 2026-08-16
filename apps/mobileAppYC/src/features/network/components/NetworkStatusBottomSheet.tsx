import React, {useCallback, useMemo, useRef} from 'react';
import {View, StyleSheet, Text} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import NetInfo from '@react-native-community/netinfo';
import CustomBottomSheet, {
  type BottomSheetRef,
} from '@/shared/components/common/BottomSheet/BottomSheet';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';

export interface NetworkStatusBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface NetworkStatusBottomSheetProps {
  bottomInset?: number;
}

// The offline inline banner is a dark chip that reads the same in both themes,
// so it uses a fixed dark-surface palette (warm-white ink, soft blue retry,
// red-tinted status glyph) rather than theme tokens.
const BANNER_INK = '#F4EFE6';
const BANNER_RETRY = '#8FB6F5';
const BANNER_ICON_BG = 'rgba(234, 55, 41, 0.22)';
const BANNER_ICON_INK = '#F28B81';

export const NetworkStatusBottomSheet = ({
  bottomInset,
  ref,
}: NetworkStatusBottomSheetProps & {
  ref?: React.Ref<NetworkStatusBottomSheetRef>;
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const bottomSheetRef = useRef<BottomSheetRef>(null);
  const [isSheetVisible, setIsSheetVisible] = React.useState(false);

  const closeSheet = useCallback(() => {
    setIsSheetVisible(false);
    bottomSheetRef.current?.close();
  }, []);

  const handleRetry = useCallback(() => {
    NetInfo.refresh();
  }, []);

  React.useImperativeHandle(ref, () => ({
    open: () => {
      setIsSheetVisible(true);
      bottomSheetRef.current?.snapToIndex(0);
    },
    close: closeSheet,
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
      behavior={{
        panDownToClose: false,
        backdrop: isSheetVisible,
        handlePanningGesture: false,
        contentPanningGesture: false,
      }}
      backdropOpacity={0.5}
      backdropAppearsOnIndex={0}
      backdropDisappearsOnIndex={-1}
      backdropPressBehavior="none"
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.bottomSheetHandle}
      bottomInset={bottomInset}
      contentType="view">
      <View style={styles.container}>
        {/* Inline "degraded connection" banner */}
        <View style={styles.banner}>
          <View style={styles.bannerIconCircle}>
            <Ionicons
              name="cloud-offline-outline"
              size={13}
              color={BANNER_ICON_INK}
            />
          </View>
          <Text style={styles.bannerText}>
            No connection · showing saved records
          </Text>
          <PressableOpacity
            testID="network-offline-banner-retry"
            accessibilityRole="button"
            accessibilityLabel="Retry connection"
            onPress={handleRetry}>
            <Text style={styles.bannerRetry}>Retry</Text>
          </PressableOpacity>
        </View>

        {/* Full offline state */}
        <View style={styles.state}>
          <View style={styles.medallion}>
            <Ionicons
              name="cloud-offline-outline"
              size={42}
              color={theme.colors.inkFaint}
            />
          </View>
          <Text style={styles.title}>You're offline</Text>
          <Text style={styles.body}>
            Your saved records still work. Booking, chat and sync will pick up
            where you left off once you're back.
          </Text>
          <PressableOpacity
            testID="network-offline-retry"
            accessibilityRole="button"
            accessibilityLabel="Try again"
            onPress={handleRetry}
            style={styles.ctaButton}>
            <Ionicons
              name="refresh-outline"
              size={18}
              color={theme.colors.ctaText}
            />
            <Text style={styles.ctaText}>Try again</Text>
          </PressableOpacity>
          <PressableOpacity
            testID="network-offline-open-saved"
            accessibilityRole="button"
            accessibilityLabel="Open saved records"
            onPress={closeSheet}
            style={styles.linkButton}>
            <Text style={styles.linkText}>Open saved records</Text>
          </PressableOpacity>
        </View>
      </View>
    </CustomBottomSheet>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    bottomSheetBackground: {
      backgroundColor: theme.colors.screen,
      borderTopLeftRadius: theme.borderRadius.sheet,
      borderTopRightRadius: theme.borderRadius.sheet,
    },
    bottomSheetHandle: {
      backgroundColor: theme.colors.divider,
    },
    container: {
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['1'],
      paddingBottom: theme.spacing['6'],
      gap: theme.spacing['4'],
    },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['2.5'],
      backgroundColor: theme.colors.spot,
      borderRadius: theme.spacing['3.5'],
      paddingVertical: 11,
      paddingHorizontal: theme.spacing['3.5'],
      marginTop: theme.spacing['3'],
      ...theme.shadows.cta,
    },
    bannerIconCircle: {
      width: theme.spacing['6'],
      height: theme.spacing['6'],
      borderRadius: theme.spacing['3'],
      backgroundColor: BANNER_ICON_BG,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bannerText: {
      ...theme.typography.clashBody13,
      flex: 1,
      color: BANNER_INK,
    },
    bannerRetry: {
      ...theme.typography.subtitleBold12,
      color: BANNER_RETRY,
    },
    state: {
      alignItems: 'center',
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['2'],
    },
    medallion: {
      width: 104,
      height: 104,
      borderRadius: theme.borderRadius.pill,
      backgroundColor: theme.colors.screen2,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing['3.5'],
    },
    title: {
      ...theme.typography.emptyStateTitle,
      color: theme.colors.ink,
      textAlign: 'center',
    },
    body: {
      ...theme.typography.body14,
      fontSize: 14.5,
      lineHeight: 22,
      color: theme.colors.inkMuted,
      textAlign: 'center',
      marginTop: theme.spacing['1.5'],
    },
    ctaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'stretch',
      gap: theme.spacing['2'],
      height: 52,
      borderRadius: theme.borderRadius.button,
      backgroundColor: theme.colors.cta,
      paddingHorizontal: theme.spacing['6'],
      marginTop: theme.spacing['4.5'],
      ...theme.shadows.cta,
    },
    ctaText: {
      ...theme.typography.button,
      color: theme.colors.ctaText,
    },
    linkButton: {
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing['1'],
    },
    linkText: {
      ...theme.typography.labelSmall,
      fontSize: 14.5,
      fontWeight: '600',
      color: theme.colors.blueText,
    },
  });

export default NetworkStatusBottomSheet;
