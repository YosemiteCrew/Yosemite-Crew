import React, { forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { useTheme } from '@/hooks';
import { Images } from '@/assets/images';
import CustomBottomSheet, { type BottomSheetRef } from '@/shared/components/common/BottomSheet/BottomSheet';
import { LiquidGlassCard } from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';

export interface EmergencyBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface EmergencyOption {
  id: 'call-vet' | 'adverse-event';
  title: string;
  subtitle: string;
  icon: any;
  iconBackgroundColor: string;
  note?: string;
}

interface EmergencyBottomSheetProps {
  onCallVet?: () => void;
  onAdverseEvent?: () => void;
}

export const EmergencyBottomSheet = forwardRef<EmergencyBottomSheetRef, EmergencyBottomSheetProps>(
  ({ onCallVet, onAdverseEvent }, ref) => {
    const { theme } = useTheme();
    const bottomSheetRef = useRef<BottomSheetRef>(null);
    const [isSheetVisible, setIsSheetVisible] = React.useState(false);

    const companions = useSelector((state: RootState) => state.companion.companions);
    const linkedBusinesses = useSelector((state: RootState) => state.linkedBusinesses.linkedBusinesses);

    const styles = useMemo(() => createStyles(theme), [theme]);

    const hasCompanion = companions && companions.length > 0;
    const hasLinkedBusiness = linkedBusinesses && linkedBusinesses.length > 0;
    const canShowOptions = hasCompanion && hasLinkedBusiness;

    const emergencyOptions: EmergencyOption[] = [
      {
        id: 'call-vet',
        title: 'Call vet/ Practice',
        subtitle: 'Quickly reach your veterinarian or practice for urgent support and guidance via phone.',
        icon: Images.medicalCap,
        iconBackgroundColor: 'rgba(252, 55, 49, 0.20)', // red
        note: 'Note: To use this feature, your hospital contact details should be added already.',
      },
      {
        id: 'adverse-event',
        title: 'Adverse event\nreporting',
        subtitle: 'Notify the vet, manufacturer and regulatory authority about issues or concerns with a pharmaceutical product.',
        icon: Images.pill,
        iconBackgroundColor: '#E9F2FD' // grey
      },
    ];

    useImperativeHandle(ref, () => ({
      open: () => {
        setIsSheetVisible(true);
        bottomSheetRef.current?.snapToIndex(0);
      },
      close: () => {
        setIsSheetVisible(false);
        bottomSheetRef.current?.close();
      },
    }));

    const handleClose = () => {
      setIsSheetVisible(false);
      bottomSheetRef.current?.close();
    };

    const handleOptionPress = (optionId: 'call-vet' | 'adverse-event') => {
      if (optionId === 'call-vet' && onCallVet) {
        onCallVet();
      } else if (optionId === 'adverse-event' && onAdverseEvent) {
        onAdverseEvent();
      }
      bottomSheetRef.current?.close();
    };

    const renderEmptyState = () => {
      const message = !hasCompanion
        ? 'Please add a companion to use this feature.'
        : 'Please add a linked hospital to use this feature.';

      return (
        <View style={styles.emptyStateContainer}>
          <Image source={Images.catEmergency} style={styles.catImage} />
          <Text style={styles.emptyStateText}>{message}</Text>
        </View>
      );
    };

    const renderOptions = () => (
      <View style={styles.optionsContainer}>
        <Image source={Images.catEmergency} style={styles.catImage} />
        <Text style={styles.titleText}>Is this an emergency?</Text>
        <Text style={styles.subtitleText}>
          Choose an option, and we'll help you take the next steps for your pet.
        </Text>

        <View style={styles.optionsGrid}>
          {emergencyOptions.map(option => (
            <TouchableOpacity
              key={option.id}
              onPress={() => handleOptionPress(option.id)}
              activeOpacity={0.85}>
              <LiquidGlassCard
                glassEffect="clear"
                interactive
                style={styles.optionCard}
                fallbackStyle={styles.optionCardFallback}>
                <View style={styles.optionContent}>
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: option.iconBackgroundColor },
                    ]}>
                    <Image source={option.icon} style={styles.optionIcon} />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>{option.title}</Text>
                    <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                    {option.note && (
                      <Text style={styles.optionNote}>{option.note}</Text>
                    )}
                  </View>
                </View>
              </LiquidGlassCard>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );

    return (
      <CustomBottomSheet
        ref={bottomSheetRef}
        snapPoints={['75%','85%']}
        initialIndex={-1}
        onChange={index => {
          setIsSheetVisible(index !== -1);
        }}
        enablePanDownToClose
        enableBackdrop={isSheetVisible}
        backdropOpacity={0.5}
        backdropAppearsOnIndex={0}
        backdropDisappearsOnIndex={-1}
        backdropPressBehavior="close"
        enableHandlePanningGesture
        enableContentPanningGesture={false}
        contentType="view"
        zIndex={99999}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetHandle}>
        <View style={styles.container}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Image source={Images.crossIcon} style={styles.closeIcon} resizeMode="contain" />
          </TouchableOpacity>
          {canShowOptions ? renderOptions() : renderEmptyState()}
        </View>
      </CustomBottomSheet>
    );
  },
);

EmergencyBottomSheet.displayName = 'EmergencyBottomSheet';

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: theme.spacing[4],
      paddingTop: theme.spacing[3],
      paddingBottom: theme.spacing[16],
      alignItems: 'center',
    },
    bottomSheetBackground: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
    },
    bottomSheetHandle: {
      backgroundColor: theme.colors.black,
      width: 80,
      height: 6,
      opacity: 0.2,
    },
    catImage: {
      width: 160,
      height: 160,
      resizeMode: 'contain',
    },
    titleText: {
      ...theme.typography.h4Alt,
      color: theme.colors.secondary,
      textAlign: 'center',
      marginBottom: theme.spacing[2],
    },
    subtitleText: {
      ...theme.typography.subtitleRegular14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing[4],
    },
    optionsContainer: {
      width: '100%',
      alignItems: 'center',
    },
    optionsGrid: {
      width: '100%',
      gap: theme.spacing[3],
    },
    optionCard: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
      overflow: 'hidden',
      minHeight: 105,
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    optionCardFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    optionContent: {
      padding: theme.spacing[4],
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
      flex: 1,
    },
    iconContainer: {
      width: 60,
      height: 60,
      borderRadius: 30,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    optionIcon: {
      width: 32,
      height: 32,
      resizeMode: 'contain',
    },
    optionTextContainer: {
      flex: 1,
      justifyContent: 'center',
      gap: theme.spacing[2],
    },
    optionTitle: {
      ...theme.typography.h6Clash,
      color: theme.colors.secondary,
      textAlign: 'left',
    },
    optionSubtitle: {
      ...theme.typography.tabLabel,
      fontSize: 11,
      lineHeight: 11 * 1.2,
      color: theme.colors.textSecondary,
      textAlign: 'left',
    },
    optionNote: {
      ...theme.typography.tabLabel,
      fontSize: 11,
      lineHeight: 11 * 1.2,
      color: theme.colors.text,
      textAlign: 'left',
    },
    emptyStateContainer: {
      width: '100%',
      alignItems: 'center',
      paddingVertical: theme.spacing[8],
    },
    emptyStateText: {
      ...theme.typography.subtitleRegular14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    closeButton: {
      position: 'absolute',
      right: theme.spacing['5'],
      top: theme.spacing['4'],
      padding: theme.spacing['2'],
      zIndex: 10,
    },
    closeIcon: {
      width: theme.spacing['6'],
      height: theme.spacing['6'],
    },
  });
