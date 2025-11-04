import React, {useMemo, useCallback} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Image,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch} from '@/app/store';
import {useTheme} from '@/hooks';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {VetBusinessCard} from '@/features/appointments/components/VetBusinessCard/VetBusinessCard';
import {
  addLinkedBusiness,
  selectLinkedBusinessesLoading,
} from '../index';
import type {LinkedBusinessStackParamList} from '@/navigation/types';
import {AddBusinessBottomSheet, type AddBusinessBottomSheetRef} from '../components/AddBusinessBottomSheet';
import {NotifyBusinessBottomSheet, type NotifyBusinessBottomSheetRef} from '../components/NotifyBusinessBottomSheet';

type Props = NativeStackScreenProps<LinkedBusinessStackParamList, 'BusinessDetails'>;

export const BusinessDetailsScreen: React.FC<Props> = ({route, navigation}) => {
  const {
    companionId,
    category,
    businessId,
    businessName,
    businessAddress,
    isPMSRecord,
    rating,
    distance,
  } = route.params;

  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();
  const loading = useSelector(selectLinkedBusinessesLoading);

  const addBusinessSheetRef = React.useRef<AddBusinessBottomSheetRef>(null);
  const notifyBusinessSheetRef = React.useRef<NotifyBusinessBottomSheetRef>(null);

  const handleAddBusiness = useCallback(async () => {
    try {
      await dispatch(
        addLinkedBusiness({
          companionId,
          businessId,
          businessName,
          category: category as any,
        }),
      ).unwrap();

      // Show add business confirmation bottom sheet
      addBusinessSheetRef.current?.open();
    } catch (error) {
      console.error('Failed to add business:', error);
      Alert.alert('Error', 'Failed to add business. Please try again.');
    }
  }, [dispatch, companionId, businessId, businessName, category]);

  const handleAddBusinessClose = useCallback(() => {
    addBusinessSheetRef.current?.close();
    // Show notification bottom sheet
    notifyBusinessSheetRef.current?.open();
  }, []);

  const handleNotifyClose = useCallback(() => {
    notifyBusinessSheetRef.current?.close();
    navigation.goBack();
  }, [navigation]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Business Details" showBackButton onBack={handleBack} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Business Card */}
        <VetBusinessCard
          name={businessName}
          address={businessAddress}
          distance={distance ? `${distance}mi` : undefined}
          rating={rating ? `${rating}` : undefined}
          cta=""
        />

        {/* PMS Status */}
        <LiquidGlassCard
          glassEffect="clear"
          style={styles.statusCard}
          fallbackStyle={styles.statusCardFallback}>
          <View style={styles.statusContent}>
            {isPMSRecord ? (
              <>
                <Image
                  source={require('@/assets/images/account/rightArrow.png')}
                  style={styles.statusIcon}
                />
                <Text style={styles.statusText}>
                  We are happy to inform you that this organisation is part of Yosemite Crew PMS
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.statusEmoji}>😔</Text>
                <Text style={styles.statusText}>
                  We are sorry to inform you, this organisation is not a part of Yosemite Crew
                  PMS. We will soon notify you, when the organisation is available on this
                  platform.
                </Text>
              </>
            )}
          </View>
        </LiquidGlassCard>

        {/* Add Button */}
        {isPMSRecord && (
          <View style={styles.buttonContainer}>
            <LiquidGlassButton
              title={loading ? 'Adding...' : 'Add'}
              onPress={handleAddBusiness}
              disabled={loading}
              height={56}
              borderRadius={16}
              tintColor={theme.colors.secondary}
              shadowIntensity="medium"
              forceBorder
              borderColor={theme.colors.borderMuted}
              loading={loading}
            />
          </View>
        )}
      </ScrollView>

      {/* Add Business Bottom Sheet */}
      <AddBusinessBottomSheet
        ref={addBusinessSheetRef}
        businessName={businessName}
        businessAddress={businessAddress}
        onConfirm={handleAddBusinessClose}
      />

      {/* Notify Business Bottom Sheet */}
      <NotifyBusinessBottomSheet
        ref={notifyBusinessSheetRef}
        businessName={businessName}
        companionName="your pet"
        onConfirm={handleNotifyClose}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[4],
      paddingBottom: theme.spacing[24],
    },
    statusCard: {
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[4],
      marginVertical: theme.spacing[4],
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    statusCardFallback: {
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.cardBackground,
      borderColor: theme.colors.borderMuted,
      borderWidth: 1,
    },
    statusContent: {
      alignItems: 'center',
      gap: theme.spacing[3],
    },
    statusIcon: {
      width: 40,
      height: 40,
      resizeMode: 'contain',
    },
    statusEmoji: {
      fontSize: 40,
    },
    statusText: {
      ...theme.typography.bodySmall,
      color: theme.colors.text,
      textAlign: 'center',
      lineHeight: 20,
    },
    buttonContainer: {
      marginTop: theme.spacing[6],
      marginBottom: theme.spacing[4],
    },
  });
