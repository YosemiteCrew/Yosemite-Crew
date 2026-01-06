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
import {LiquidGlassIconButton} from '@/shared/components/common/LiquidGlassIconButton/LiquidGlassIconButton';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import {
  selectLinkedHospitalsForCompanion,
} from '@/features/linkedBusinesses';

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
  companionId?: string | null;
  onCallVet?: () => void | Promise<void>;
  onAdverseEvent?: () => void | Promise<void>;
}

export const EmergencyBottomSheet = forwardRef<EmergencyBottomSheetRef, EmergencyBottomSheetProps>(
  ({ companionId, onCallVet, onAdverseEvent }, ref) => {
    const { theme } = useTheme();
    const bottomSheetRef = useRef<BottomSheetRef>(null);
    const [isSheetVisible, setIsSheetVisible] = React.useState(false);

    const styles = useMemo(() => createStyles(theme), [theme]);
    const closeButtonSize = theme.spacing['9'];

    // Get linked hospitals for the selected companion
    const linkedHospitals = useSelector((state: RootState) =>
      selectLinkedHospitalsForCompanion(state, companionId ?? null),
    );

    const hasLinkedHospital = linkedHospitals && linkedHospitals.length > 0;
    const canShowOptions = hasLinkedHospital;

    const emergencyOptions: EmergencyOption[] = [
      {
        id: 'call-vet',
        title: 'Call vet/ Practice',
        subtitle: 'Quickly reach your veterinarian or practice for urgent support and guidance via phone.',
        icon: Images.medicalCap,
        iconBackgroundColor: theme.colors.errorSurface,
        note: 'Note: To use this feature, your hospital contact details should be added already.',
      },
      {
        id: 'adverse-event',
        title: 'Adverse event\nreporting',
        subtitle: 'Notify the vet, manufacturer and regulatory authority about issues or concerns with a pharmaceutical product.',
        icon: Images.pill,
        iconBackgroundColor: theme.colors.lightBlueBackground,
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

    const handleOptionPress = async (optionId: 'call-vet' | 'adverse-event') => {
      try {
        if (optionId === 'call-vet' && onCallVet) {
          await onCallVet();
        } else if (optionId === 'adverse-event' && onAdverseEvent) {
          await onAdverseEvent();
        }
      } finally {
        bottomSheetRef.current?.close();
      }
    };

    const renderEmptyState = () => {
      const message = 'Please link a hospital to use this feature.';

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
        snapPoints={['80%','85%']}
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
          <LiquidGlassIconButton
            onPress={handleClose}
            size={closeButtonSize}
            style={styles.closeButton}>
            <Image source={Images.crossIcon} style={styles.closeIcon} resizeMode="contain" />
          </LiquidGlassIconButton>
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
      paddingHorizontal: theme.spacing['4'],
      paddingTop: theme.spacing['3'],
      paddingBottom: theme.spacing['16'],
      alignItems: 'center',
    },
    bottomSheetBackground: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: theme.borderRadius['3xl'],
      borderTopRightRadius: theme.borderRadius['3xl'],
    },
    bottomSheetHandle: {
      backgroundColor: theme.colors.black,
      width: theme.spacing['20'],
      height: theme.spacing['1.25'] + 1,
      opacity: 0.2,
    },
    catImage: {
      width: theme.spacing['40'],
      height: theme.spacing['40'],
      resizeMode: 'contain',
    },
    titleText: {
      ...theme.typography.h4Alt,
      color: theme.colors.secondary,
      textAlign: 'center',
      marginBottom: theme.spacing['2'],
    },
    subtitleText: {
      ...theme.typography.subtitleRegular14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing['4'],
    },
    optionsContainer: {
      width: '100%',
      alignItems: 'center',
    },
    optionsGrid: {
      width: '100%',
      gap: theme.spacing['3'],
    },
    optionCard: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
      minHeight: theme.spacing['24'] + theme.spacing['2'] + 1,
      ...theme.shadows.sm,
    },
    optionCardFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    optionContent: {
      padding: theme.spacing['4'],
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
      flex: 1,
    },
    iconContainer: {
      width: theme.spacing['16'],
      height: theme.spacing['16'],
      borderRadius: theme.borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    optionIcon: {
      width: theme.spacing['8'],
      height: theme.spacing['8'],
      resizeMode: 'contain',
    },
    optionTextContainer: {
      flex: 1,
      justifyContent: 'center',
      gap: theme.spacing['2'],
    },
    optionTitle: {
      ...theme.typography.h6Clash,
      color: theme.colors.secondary,
      textAlign: 'left',
    },
    optionSubtitle: {
      ...theme.typography.tabLabel,
      color: theme.colors.textSecondary,
      textAlign: 'left',
    },
    optionNote: {
      ...theme.typography.tabLabel,
      color: theme.colors.text,
      textAlign: 'left',
    },
    emptyStateContainer: {
      width: '100%',
      alignItems: 'center',
      paddingVertical: theme.spacing['8'],
    },
    emptyStateText: {
      ...theme.typography.subtitleRegular14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    closeButton: {
      justifyContent: 'center',
      alignItems: 'center',
      position: 'absolute',
      right: theme.spacing['5'],
      top: theme.spacing['4'],
    },
    closeIcon: {
      width: theme.spacing['6'],
      height: theme.spacing['6'],
    },
  });
