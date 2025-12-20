import React, {useMemo, useCallback, useState, useEffect} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Alert,
  Image,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch} from '@/app/store';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {VetBusinessCard} from '@/features/appointments/components/VetBusinessCard/VetBusinessCard';
import {
  addLinkedBusiness,
  selectLinkedBusinessesLoading,
  fetchBusinessDetails,
  fetchGooglePlacesImage,
  inviteBusiness,
  linkBusiness,
} from '../index';
import type {LinkedBusinessStackParamList} from '@/navigation/types';
import {AddBusinessBottomSheet, type AddBusinessBottomSheetRef} from '../components/AddBusinessBottomSheet';
import {NotifyBusinessBottomSheet, type NotifyBusinessBottomSheetRef} from '../components/NotifyBusinessBottomSheet';

type Props = NativeStackScreenProps<LinkedBusinessStackParamList, 'BusinessAdd'>;

export const BusinessAddScreen: React.FC<Props> = ({route, navigation}) => {
  const {
    companionId,
    category,
    businessId,
    businessName,
    businessAddress,
    phone,
    email,
    isPMSRecord,
    rating,
    distance,
    photo,
    placeId,
    companionName,
    organisationId,
  } = route.params;

  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();
  const loading = useSelector(selectLinkedBusinessesLoading);

  const addBusinessSheetRef = React.useRef<AddBusinessBottomSheetRef>(null);
  const notifyBusinessSheetRef = React.useRef<NotifyBusinessBottomSheetRef>(null);

  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [detailedPhoto, setDetailedPhoto] = useState<string | undefined>(photo);
  const [detailedPhone, setDetailedPhone] = useState<string | undefined>(phone);
  const [detailedWebsite, setDetailedWebsite] = useState<string | undefined>(email);

  // Log params only when they change, not on every render
  useEffect(() => {
    console.log('[BusinessAddScreen] Received params:', {
      businessName,
      businessAddress,
      phone,
      email,
      photo,
      photoType: typeof photo,
      isPMSRecord,
      placeId,
      category,
    });
    console.log('[BusinessAddScreen] isPMSRecord:', isPMSRecord, '| Should fetch details:', !isPMSRecord && !!placeId);
  }, [businessName, businessAddress, phone, email, photo, isPMSRecord, placeId, category]);

  // Fetch detailed business information for non-PMS businesses when screen loads
  // For PMS businesses, only fetch the image from Places API
  // IMPORTANT: Only depend on placeId and isPMSRecord to prevent infinite loops
  // Do NOT include detailedPhoto/Phone/Website in dependencies - they cause re-fetches when state updates
  useEffect(() => {
    if (placeId) {
      setFetchingDetails(true);

      if (isPMSRecord) {
        // For PMS records, only fetch the image
        dispatch(fetchGooglePlacesImage(placeId))
          .unwrap()
          .then(result => {
            console.log('[BusinessAddScreen] Fetched Places image:', result.photoUrl);
            if (result.photoUrl) {
              console.log('[BusinessAddScreen] Setting detailed photo to:', result.photoUrl);
              setDetailedPhoto(result.photoUrl);
            }
          })
          .catch(error => {
            console.warn('[BusinessAddScreen] Failed to fetch Places image:', error);
            // Continue without image - graceful degradation
          })
          .finally(() => {
            setFetchingDetails(false);
          });
      } else {
        // For non-PMS records, fetch all details (photo, phone, website)
        dispatch(fetchBusinessDetails(placeId))
          .unwrap()
          .then(result => {
            console.log('[BusinessAddScreen] Fetched details:', result);
            console.log('[BusinessAddScreen] PhotoUrl from API:', result.photoUrl);
            if (result.photoUrl) {
              console.log('[BusinessAddScreen] Setting detailed photo to:', result.photoUrl);
              setDetailedPhoto(result.photoUrl);
            }
            if (result.phoneNumber) {
              setDetailedPhone(result.phoneNumber);
            }
            if (result.website) {
              setDetailedWebsite(result.website);
            }
          })
          .catch(error => {
            console.warn('[BusinessAddScreen] Failed to fetch details:', error);
            // Continue without detailed info - graceful degradation
          })
          .finally(() => {
            setFetchingDetails(false);
          });
      }
    }
  }, [isPMSRecord, placeId, dispatch]);


  const handleAddBusiness = useCallback(async () => {
    try {
      if (isPMSRecord && organisationId) {
        // For PMS businesses, use linkBusiness thunk
        console.log('[BusinessAddScreen] Linking PMS business:', organisationId);
        await dispatch(
          linkBusiness({
            companionId,
            organisationId,
            category: category as any,
          }),
        ).unwrap();
      } else {
        // For non-PMS businesses, use addLinkedBusiness
        console.log('[BusinessAddScreen] Adding non-PMS business');
        await dispatch(
          addLinkedBusiness({
            companionId,
            businessId,
            businessName,
            category: category as any,
            address: businessAddress,
            phone: detailedPhone || phone,
            email: detailedWebsite || email,
            distance,
            rating,
            photo: detailedPhoto || photo,
          }),
        ).unwrap();
      }

      // Show add business confirmation bottom sheet
      addBusinessSheetRef.current?.open();
    } catch (error) {
      console.error('Failed to add business:', error);
      Alert.alert('Error', 'Failed to add business. Please try again.');
    }
  }, [dispatch, companionId, businessId, businessName, category, businessAddress, phone, email, distance, rating, photo, detailedPhone, detailedWebsite, detailedPhoto, isPMSRecord, organisationId]);

  const handleAddBusinessClose = useCallback(() => {
    addBusinessSheetRef.current?.close();
    // Navigate back to refresh the linked businesses list
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handleNotifyClose = useCallback(() => {
    notifyBusinessSheetRef.current?.close();
    navigation.goBack();
  }, [navigation]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);


  const handleNotifyPress = useCallback(async () => {
    try {
      console.log('[BusinessAddScreen] Sending invite to business:', businessName);
      await dispatch(
        inviteBusiness({
          companionId,
          email: '',
          businessName: businessName || 'Unknown Business',
          category: category as any,
        }),
      ).unwrap();

      // Show notification sheet
      notifyBusinessSheetRef.current?.open();
      console.log('[BusinessAddScreen] Invite sent successfully');
    } catch (error) {
      console.error('[BusinessAddScreen] Failed to send invite:', error);
      Alert.alert('Error', 'Failed to send invite. Please try again.');
    }
  }, [dispatch, companionId, category, businessName]);

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Add Business" showBackButton onBack={handleBack} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Business Card */}
        <VetBusinessCard
          photo={detailedPhoto}
          name={businessName}
          address={businessAddress}
          distance={distance ? `${distance}mi` : undefined}
          rating={rating ? `${rating}` : undefined}
          website={detailedWebsite}
          cta=""
        />

        {/* PMS Status Card */}
        <LiquidGlassCard
          glassEffect="regular"
          interactive
          style={styles.statusCard}
          fallbackStyle={styles.statusCardFallback}>
          <View style={styles.statusContent}>
            {isPMSRecord ? (
              <View style={styles.statusRow}>
                <Text style={styles.statusEmojiLeft}>🎉</Text>
                <Text style={styles.statusText}>
                  We are happy to inform you that this organisation is part of Yosemite Crew PMS
                </Text>
   <Image
                  source={Images.yosemiteLogo}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
            ) : (
              <View style={styles.statusRow}>
                <Text style={styles.statusEmojiLeft}>😔</Text>
                <Text style={styles.statusText}>
                  We are sorry to inform you, this organisation is not a part of Yosemite Crew
                  PMS. We will soon notify you, when the organisation is available on this
                  platform.
                </Text>
            <Text style={styles.statusEmojiRight}>🔔</Text>
              </View>
            )}
          </View>
        </LiquidGlassCard>

        {/* Add Button or Notify Button */}
        <View style={styles.buttonContainer}>
          {isPMSRecord ? (
            <LiquidGlassButton
              title={loading ? 'Adding...' : 'Add'}
              onPress={handleAddBusiness}
              disabled={loading}
              glassEffect="clear"
              height={56}
              borderRadius={16}
              tintColor={theme.colors.secondary}
              textStyle={styles.buttonText}
              shadowIntensity="medium"
              forceBorder
              borderColor={theme.colors.borderMuted}
              loading={loading}
            />
          ) : (
            <LiquidGlassButton
              title="Notify Business"
              onPress={handleNotifyPress}
              disabled={fetchingDetails}
              glassEffect="clear"
              height={56}
              borderRadius={16}
              tintColor={theme.colors.secondary}
              textStyle={styles.buttonText}
              shadowIntensity="medium"
              forceBorder
              borderColor={theme.colors.borderMuted}
            />
          )}
        </View>
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
        companionName={companionName}
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
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['4'],
      paddingBottom: theme.spacing['24'],
      gap: theme.spacing['4'],
    },
    statusCard: {
      borderRadius: theme.borderRadius.lg,
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['4'],
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    statusCardFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderColor: theme.colors.border,
      borderWidth: 1,
    },
    statusContent: {
      alignItems: 'center',
      gap: theme.spacing['3'],
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing['2'],
    },
    statusEmojiLeft: {
      ...theme.typography.h1,
      flex: 0.12,
      textAlign: 'right',
    },
    statusEmojiRight: {
      ...theme.typography.h1,
      flex: 0.12,
      textAlign: 'left',
    },
    statusText: {
      ...theme.typography.captionBoldSatoshi,
      color: theme.colors.text,
      textAlign: 'center',
      lineHeight: 20,
      flex: 0.76,
    },
    logoImage: {
      width: 52,
      height: 52,
    },
    buttonContainer: {
      marginTop: theme.spacing['6'],
      marginBottom: theme.spacing['4'],
    },
    buttonText: {
      ...theme.typography.cta,
      color: theme.colors.white,
    },
  });
