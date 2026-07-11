import React, {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useReducer,
} from 'react';
import {View, ScrollView, StyleSheet, Text, Alert, Image} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch} from '@/app/store';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {
  addLinkedBusiness,
  fetchBusinessDetails,
  fetchGooglePlacesImage,
  inviteBusiness,
  linkBusiness,
} from '../thunks';
import {selectLinkedBusinessesLoading} from '../selectors';
import type {LinkedBusinessStackParamList} from '@/navigation/types';
import {
  AddBusinessBottomSheet,
  type AddBusinessBottomSheetRef,
} from '../components/AddBusinessBottomSheet';
import {
  NotifyBusinessBottomSheet,
  type NotifyBusinessBottomSheetRef,
} from '../components/NotifyBusinessBottomSheet';

type Props = NativeStackScreenProps<
  LinkedBusinessStackParamList,
  'BusinessAdd'
>;
type BusinessDetails = {
  photo: string | undefined;
  phone: string | undefined;
  website: string | undefined;
};

type BusinessDetailsAction =
  | {type: 'SET_PHOTO'; payload: string}
  | {type: 'SET_ALL'; payload: Partial<BusinessDetails>};

function businessDetailsReducer(
  state: BusinessDetails,
  action: BusinessDetailsAction,
): BusinessDetails {
  switch (action.type) {
    case 'SET_PHOTO':
      return {...state, photo: action.payload};
    case 'SET_ALL':
      return {...state, ...action.payload};
    default:
      return state;
  }
}

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
    returnTo,
  } = route.params;

  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();
  const loading = useSelector(selectLinkedBusinessesLoading);

  const addBusinessSheetRef = React.useRef<AddBusinessBottomSheetRef>(null);
  const notifyBusinessSheetRef =
    React.useRef<NotifyBusinessBottomSheetRef>(null);

  const [fetchingDetails, setFetchingDetails] = useState(!!placeId);
  const [details, dispatchDetails] = useReducer(businessDetailsReducer, {
    photo,
    phone,
    website: email,
  });

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
    console.log(
      '[BusinessAddScreen] isPMSRecord:',
      isPMSRecord,
      '| Should fetch details:',
      !isPMSRecord && !!placeId,
    );
  }, [
    businessName,
    businessAddress,
    phone,
    email,
    photo,
    isPMSRecord,
    placeId,
    category,
  ]);

  // Fetch detailed business information for non-PMS businesses when screen loads.
  // For PMS businesses, only fetch the image from Places API.
  // IMPORTANT: Only depend on placeId and isPMSRecord to prevent infinite loops.
  // Details state is managed via a reducer so each branch makes exactly one
  // dispatch call, satisfying the react-doctor/no-cascading-set-state rule.
  useEffect(() => {
    if (!placeId) {
      return;
    }

    if (isPMSRecord) {
      // For PMS records, only fetch the image
      dispatch(fetchGooglePlacesImage(placeId))
        .unwrap()
        .then(result => {
          console.log(
            '[BusinessAddScreen] Fetched Places image:',
            result.photoUrl,
          );
          if (result.photoUrl) {
            console.log(
              '[BusinessAddScreen] Setting detailed photo to:',
              result.photoUrl,
            );
            dispatchDetails({type: 'SET_PHOTO', payload: result.photoUrl});
          }
        })
        .catch(error => {
          console.warn(
            '[BusinessAddScreen] Failed to fetch Places image:',
            error,
          );
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
          console.log(
            '[BusinessAddScreen] PhotoUrl from API:',
            result.photoUrl,
          );
          dispatchDetails({
            type: 'SET_ALL',
            payload: {
              ...(result.photoUrl && {photo: result.photoUrl}),
              ...(result.phoneNumber && {phone: result.phoneNumber}),
              ...(result.website && {website: result.website}),
            },
          });
        })
        .catch(error => {
          console.warn('[BusinessAddScreen] Failed to fetch details:', error);
          // Continue without detailed info - graceful degradation
        })
        .finally(() => {
          setFetchingDetails(false);
        });
    }
  }, [isPMSRecord, placeId, dispatch]);

  const handleAddBusiness = useCallback(async () => {
    try {
      if (isPMSRecord && organisationId) {
        // For PMS businesses, use linkBusiness thunk
        console.log(
          '[BusinessAddScreen] Linking PMS business:',
          organisationId,
        );
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
            phone: details.phone || phone,
            email: details.website || email,
            distance,
            rating,
            photo: details.photo || photo,
          }),
        ).unwrap();
      }

      // Show add business confirmation bottom sheet
      addBusinessSheetRef.current?.open();
    } catch (error) {
      console.error('Failed to add business:', error);
      Alert.alert('Error', 'Failed to add business. Please try again.');
    }
  }, [
    dispatch,
    companionId,
    businessId,
    businessName,
    category,
    businessAddress,
    phone,
    email,
    distance,
    rating,
    photo,
    details,
    isPMSRecord,
    organisationId,
  ]);

  const handleAddBusinessClose = useCallback(() => {
    addBusinessSheetRef.current?.close();
    // Navigate back to refresh the linked businesses list
    if (returnTo?.tab) {
      const tabNav = navigation.getParent<any>();
      if (tabNav) {
        const params = returnTo.screen ? {screen: returnTo.screen} : undefined;
        tabNav.navigate(returnTo.tab, params as any);
      }
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation, returnTo]);

  const handleNotifyClose = useCallback(() => {
    notifyBusinessSheetRef.current?.close();
    if (returnTo?.tab) {
      const tabNav = navigation.getParent<any>();
      if (tabNav) {
        const params = returnTo.screen ? {screen: returnTo.screen} : undefined;
        tabNav.navigate(returnTo.tab, params as any);
      }
      return;
    }
    navigation.goBack();
  }, [navigation, returnTo]);

  const handleBack = useCallback(() => {
    if (returnTo?.tab) {
      const tabNav = navigation.getParent<any>();
      if (tabNav) {
        const params = returnTo.screen ? {screen: returnTo.screen} : undefined;
        tabNav.navigate(returnTo.tab, params as any);
      }
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation, returnTo]);

  const handleNotifyPress = useCallback(async () => {
    try {
      console.log(
        '[BusinessAddScreen] Sending invite to business:',
        businessName,
      );
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

  const companionInitial = (companionName ?? '').trim().charAt(0).toUpperCase();
  const photoUri =
    typeof details.photo === 'string' && details.photo.length > 0
      ? details.photo
      : undefined;
  const metaLine = [businessAddress, distance ? `${distance}mi` : null]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <>
      <LiquidGlassHeaderScreen
        header={
          <Header
            title="Connect"
            showBackButton
            onBack={handleBack}
            glass={false}
          />
        }
        contentPadding={theme.spacing['4']}
        showBottomFade={false}>
        {contentPaddingStyle => (
          <View style={styles.fill}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[
                styles.scrollContent,
                contentPaddingStyle,
              ]}
              showsVerticalScrollIndicator={false}>
              {/* Business header card */}
              <View style={styles.businessCard}>
                <View style={styles.businessTile}>
                  {photoUri ? (
                    <Image
                      source={{uri: photoUri}}
                      style={styles.businessTileImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons
                      name="medkit-outline"
                      size={24}
                      color={theme.colors.avatarGreenInk}
                    />
                  )}
                </View>
                <View style={styles.businessInfo}>
                  <Text style={styles.businessName} numberOfLines={2}>
                    {businessName}
                  </Text>
                  {!!metaLine && (
                    <Text style={styles.businessMeta} numberOfLines={2}>
                      {metaLine}
                    </Text>
                  )}
                  {!!details.website && (
                    <Text style={styles.businessWebsite} numberOfLines={1}>
                      {details.website}
                    </Text>
                  )}
                </View>
                {!!rating && (
                  <View style={styles.ratingChip}>
                    <Ionicons name="star" size={12} color={theme.colors.pink} />
                    <Text style={styles.ratingText}>{`${rating}`}</Text>
                  </View>
                )}
              </View>

              {/* Companion this link is for */}
              {!!companionName && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Link for</Text>
                  <View style={styles.companionRow}>
                    <View style={styles.companionChip}>
                      <View style={styles.companionAvatar}>
                        <Text style={styles.companionInitial}>
                          {companionInitial}
                        </Text>
                      </View>
                      <Text style={styles.companionName} numberOfLines={1}>
                        {companionName}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Connection status */}
              <View
                style={[
                  styles.statusBanner,
                  isPMSRecord
                    ? styles.statusBannerSuccess
                    : styles.statusBannerInfo,
                ]}>
                {isPMSRecord ? (
                  <>
                    <Text style={styles.statusEmoji}>🎉</Text>
                    <Text style={styles.statusText}>
                      We are happy to inform you that this organisation is part
                      of Yosemite Crew PMS
                    </Text>
                    <Image
                      source={Images.yosemiteLogo}
                      style={styles.logoImage}
                      resizeMode="contain"
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.statusEmoji}>😔</Text>
                    <Text style={styles.statusText}>
                      We are sorry to inform you, this organisation is not a
                      part of Yosemite Crew PMS. We will soon notify you, when
                      the organisation is available on this platform.
                    </Text>
                    <Text style={styles.statusEmoji}>🔔</Text>
                  </>
                )}
              </View>
            </ScrollView>

            {/* Bottom action bar */}
            <View style={styles.bottomBar}>
              {isPMSRecord ? (
                <LiquidGlassButton
                  title={loading ? 'Adding...' : 'Add'}
                  onPress={handleAddBusiness}
                  disabled={loading}
                  glassEffect="clear"
                  height={56}
                  borderRadius={theme.borderRadius.button}
                  tintColor={theme.colors.cta}
                  textStyle={styles.buttonText}
                  shadowIntensity="medium"
                  loading={loading}
                  leftIcon={
                    <Ionicons
                      name="link-outline"
                      size={18}
                      color={theme.colors.ctaText}
                    />
                  }
                />
              ) : (
                <LiquidGlassButton
                  title="Notify Business"
                  onPress={handleNotifyPress}
                  disabled={fetchingDetails}
                  glassEffect="clear"
                  height={56}
                  borderRadius={theme.borderRadius.button}
                  tintColor={theme.colors.cta}
                  textStyle={styles.buttonText}
                  shadowIntensity="medium"
                  leftIcon={
                    <Ionicons
                      name="notifications-outline"
                      size={18}
                      color={theme.colors.ctaText}
                    />
                  }
                />
              )}
            </View>
          </View>
        )}
      </LiquidGlassHeaderScreen>

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
    </>
  );
};

const createStyles = (theme: any) => {
  return StyleSheet.create({
    fill: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing['5'],
      paddingBottom: theme.spacing['6'],
      gap: theme.spacing['4'],
    },
    businessCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
      backgroundColor: theme.colors.screen,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      borderRadius: theme.borderRadius.card,
      paddingVertical: theme.spacing['4.5'],
      paddingHorizontal: theme.spacing['4'],
      ...theme.shadows.card,
    },
    businessTile: {
      width: 52,
      height: 52,
      borderRadius: theme.borderRadius.cardSmall,
      backgroundColor: theme.colors.avatarGreenBg,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    businessTileImage: {
      width: 52,
      height: 52,
    },
    businessInfo: {
      flex: 1,
      gap: theme.spacing['1'],
    },
    businessName: {
      ...theme.typography.paragraphBold,
      color: theme.colors.ink,
    },
    businessMeta: {
      ...theme.typography.caption,
      color: theme.colors.inkFaint,
    },
    businessWebsite: {
      ...theme.typography.caption,
      color: theme.colors.blueText,
    },
    ratingChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: theme.spacing['1'],
    },
    ratingText: {
      ...theme.typography.captionBold,
      color: theme.colors.inkBody,
    },
    section: {
      gap: theme.spacing['2'],
    },
    sectionLabel: {
      ...theme.typography.eyebrow,
      color: theme.colors.inkFaint,
    },
    companionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing['2.5'],
    },
    companionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['2'],
      paddingVertical: theme.spacing['1.25'],
      paddingHorizontal: theme.spacing['2.5'],
      borderRadius: theme.borderRadius.pill,
      borderWidth: 1.5,
      borderColor: theme.colors.pink,
      backgroundColor: theme.colors.screen,
      ...theme.shadows.companion,
    },
    companionAvatar: {
      width: 30,
      height: 30,
      borderRadius: theme.borderRadius.pill,
      backgroundColor: theme.colors.avatarAmberBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    companionInitial: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.avatarAmberInk,
    },
    companionName: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.ink,
    },
    statusBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['2.5'],
      paddingVertical: theme.spacing['3'],
      paddingHorizontal: theme.spacing['3.5'],
      borderRadius: theme.borderRadius.cardSmall,
    },
    statusBannerSuccess: {
      backgroundColor: theme.colors.successSurface,
    },
    statusBannerInfo: {
      backgroundColor: theme.colors.blueSoft,
    },
    statusEmoji: {
      ...theme.typography.h5,
    },
    statusText: {
      ...theme.typography.mobileFootnote,
      color: theme.colors.inkBody,
      flex: 1,
    },
    logoImage: {
      width: 44,
      height: 44,
    },
    bottomBar: {
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['3'],
      paddingBottom: theme.spacing['6'],
      backgroundColor: theme.colors.background,
    },
    buttonText: {
      ...theme.typography.cta,
      color: theme.colors.ctaText,
    },
  });
};
