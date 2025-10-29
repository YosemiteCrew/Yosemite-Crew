import React, {forwardRef} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import CustomBottomSheet, {type BottomSheetRef} from '@/shared/components/common/BottomSheet/BottomSheet';
import {useTheme} from '@/hooks';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';

export interface InfoBottomSheetRef extends BottomSheetRef {}

export const InfoBottomSheet = forwardRef<InfoBottomSheetRef, {
  title: string;
  message: string;
  cta?: string;
  onCta?: () => void;
}>(({title, message, cta = 'Close', onCta}, ref) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return (
    <CustomBottomSheet
      ref={ref}
      initialIndex={-1}
      snapPoints={["40%","60%"]}
      enablePanDownToClose
      enableDynamicSizing={false}
      enableBackdrop
      backdropOpacity={0.5}
      backdropAppearsOnIndex={0}
      backdropDisappearsOnIndex={-1}
      backdropPressBehavior="close"
    >
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <LiquidGlassButton title={cta} onPress={() => onCta?.()} height={52} borderRadius={16} />
      </View>
    </CustomBottomSheet>
  );
});

const createStyles = (theme: any) => StyleSheet.create({
  container: {gap: 12, padding: 16},
  title: {...theme.typography.titleLarge, color: theme.colors.secondary},
  message: {...theme.typography.paragraph, color: theme.colors.textSecondary},
});

export default InfoBottomSheet;
