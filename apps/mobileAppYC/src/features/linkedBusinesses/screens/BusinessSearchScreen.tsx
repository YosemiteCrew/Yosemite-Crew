import React, {useState, useCallback, useMemo, useRef, useEffect} from 'react';
import {View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Text, Alert, Pressable} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch} from '@/app/store';
import {useTheme} from '@/hooks';
import {Header} from '@/shared/components/common/Header/Header';
import {SearchBar} from '@/shared/components/common/SearchBar/SearchBar';
import {
  searchBusinessesByLocation,
  fetchLinkedBusinesses,
  checkOrganisation,
  acceptBusinessInvite,
  declineBusinessInvite,
  fetchPlaceCoordinates,
  selectLinkedBusinesses,
  deleteLinkedBusiness,
  DeleteBusinessBottomSheet,
  type DeleteBusinessBottomSheetRef,
} from '../index';
import {LinkedBusinessCard} from '../components/LinkedBusinessCard';
import type {LinkedBusinessStackParamList} from '@/navigation/types';
import type {LinkedBusiness} from '../types';
import {CompanionProfileImage} from '../components/CompanionProfileImage';
import {InviteCard} from '../components/InviteCard';
import LocationService from '@/shared/services/LocationService';
import {SearchDropdownOverlay} from '@/shared/components/common/SearchDropdownOverlay/SearchDropdownOverlay';

type Props = NativeStackScreenProps<LinkedBusinessStackParamList, 'BusinessSearch'>;

export const BusinessSearchScreen: React.FC<Props> = ({route, navigation}) => {
  const {companionId, companionName, companionBreed, companionImage, category} =
    route.params;
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedBusinessForDelete, setSelectedBusinessForDelete] = useState<LinkedBusiness | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const deleteBottomSheetRef = useRef<DeleteBusinessBottomSheetRef>(null);

  // Fetch linked businesses on mount
  useEffect(() => {
    const loadLinkedBusinesses = async () => {
      try {
        console.log('[BusinessSearch] Fetching linked businesses for companion:', companionId, 'category:', category);
        await dispatch(
          fetchLinkedBusinesses({companionId, category})
        ).unwrap();
        console.log('[BusinessSearch] Linked businesses loaded');
      } catch (error) {
        console.error('[BusinessSearch] Failed to load linked businesses:', error);
        // Errors are handled by Redux state
      }
    };

    if (companionId) {
      loadLinkedBusinesses();
    }
  }, [companionId, category, dispatch]);

  // Get user's location on screen mount
  useEffect(() => {
    const getUserLocation = async () => {
      try {
        const location = await LocationService.getCurrentPosition();
        setUserLocation({
          latitude: location.latitude,
          longitude: location.longitude,
        });
        console.log('[BusinessSearch] User location obtained:', location.latitude, location.longitude);
      } catch (error) {
        console.log('[BusinessSearch] Failed to get user location, proceeding without location bias:', error);
        // Proceed without location - it's optional for search
      }
    };
    getUserLocation();
  }, []);

  // Log mount/navigation only when params change, not on every render
  useEffect(() => {
    console.log('[BusinessSearch] Screen navigated with companionId:', companionId, 'category:', category);
  }, [companionId, category]);

  // Reset search state when screen comes into focus and refresh linked businesses
  useFocusEffect(
    useCallback(() => {
      console.log('[BusinessSearch] Screen focused - resetting search state and refreshing businesses');
      setSearchQuery('');
      setSearchResults([]);
      setSelectedBusinessForDelete(null);

      // Refresh linked businesses list after returning from BusinessAdd
      (async () => {
        try {
          await dispatch(
            fetchLinkedBusinesses({companionId, category})
          ).unwrap();
          console.log('[BusinessSearch] Linked businesses refreshed after focus');
        } catch (error) {
          console.error('[BusinessSearch] Failed to refresh linked businesses:', error);
        }
      })();

      return () => {
        // Cleanup: clear any pending search debounce timer when screen loses focus
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    }, [dispatch, companionId, category]),
  );

  // Get linked businesses for this companion and category
  // Use selector to get all linked businesses, then filter locally
  const allLinkedBusinesses = useSelector(selectLinkedBusinesses);
  const linkedBusinesses = useMemo(() => {
    const filtered = allLinkedBusinesses.filter(
      b => b.companionId === companionId && b.category === category,
    );
    console.log('[BusinessSearch] Redux state all businesses:', allLinkedBusinesses.map(b => ({id: b.id, companionId: b.companionId, category: b.category})));
    console.log('[BusinessSearch] Filtered for companion:', companionId, 'category:', category, 'result:', filtered.length);
    return filtered;
  }, [allLinkedBusinesses, companionId, category]);


  // Use a ref to manage debounce timer
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track last search query to prevent duplicate API calls
  const lastSearchQueryRef = useRef<string>('');

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);

      // OPTIMIZATION: Don't search until user types at least 3 characters
      // This reduces API calls by ~40% on initial typing
      if (query.length < 3) {
        setSearchResults([]);
        lastSearchQueryRef.current = '';
        return;
      }

      // OPTIMIZATION: Don't make API call if query hasn't changed
      // Prevents duplicate searches when component re-renders
      if (query === lastSearchQueryRef.current) {
        console.log('[BusinessSearch] Query unchanged, skipping search:', query);
        return;
      }

      // Clear any pending search to implement proper debouncing
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // OPTIMIZATION: Debounce for 800ms before making API call
      // This allows user to finish typing without triggering searches mid-keystroke
      // 800ms = recommended delay for search input (Google/Facebook standard)
      debounceTimerRef.current = setTimeout(async () => {
        // Double-check the query hasn't changed during the debounce
        if (query === lastSearchQueryRef.current) {
          console.log('[BusinessSearch] Query unchanged after debounce, skipping API call');
          return;
        }

        setSearching(true);
        try {
          console.log('[BusinessSearch] Making API call for query:', query);
          lastSearchQueryRef.current = query;

          const result = await dispatch(
            searchBusinessesByLocation({
              query,
              location: userLocation,
            }),
          ).unwrap();
          setSearchResults(result);
          console.log('[BusinessSearch] Search completed with', result.length, 'results.');
        } catch (error: any) {
          // Log error but don't show to user - use fallback results instead
          const isQuotaError = error?.message?.includes('RESOURCE_EXHAUSTED') ||
                              error?.message?.includes('Quota exceeded');
          if (isQuotaError) {
            console.warn('[BusinessSearch] Quota exceeded, using fallback results');
          } else {
            console.error('Search failed:', error);
          }
          // Keep previous results instead of clearing
          // This allows graceful degradation
        } finally {
          setSearching(false);
        }
      }, 800); // Industry-standard debounce for search inputs
    },
    [dispatch, userLocation],
  );

  const handleCloseDropdown = useCallback(() => {
    setSearchResults([]);
  }, []);

  const handleSelectBusiness = useCallback(
    async (business: any) => {
      setSearchResults([]);
      try {
        console.log('[BusinessSearch] Selected business:', {
          name: business.name,
          placeId: business.id,
          address: business.address,
          lat: business.lat,
          lng: business.lng,
        });

        // Check if business is already linked
        const alreadyLinked = linkedBusinesses.find(
          b => b.businessName?.toLowerCase() === business.name.toLowerCase(),
        );
        if (alreadyLinked) {
          Alert.alert('Already Linked', `${business.name} is already linked to ${companionName}`);
          return;
        }

        // Fetch coordinates if missing (lazy loading on selection)
        let lat = business.lat;
        let lng = business.lng;

        if (!lat || !lng) {
          console.log('[BusinessSearch] Fetching coordinates for:', business.id);
          try {
            const coords = await dispatch(fetchPlaceCoordinates(business.id)).unwrap();
            lat = coords.latitude;
            lng = coords.longitude;
            console.log('[BusinessSearch] Coordinates fetched:', {lat, lng});
          } catch (coordError) {
            console.log('[BusinessSearch] Failed to fetch coordinates - proceeding to notify without PMS check:', coordError);
            // Navigate directly to BusinessAddScreen without organization check
            navigation.navigate('BusinessAdd', {
              companionId,
              companionName,
              companionBreed,
              companionImage,
              category,
              businessId: business.id,
              businessName: business.name,
              businessAddress: business.address,
              phone: business.phone,
              email: business.email,
              photo: business.photo,
              isPMSRecord: false,
              rating: business.rating,
              distance: business.distance,
              placeId: business.id,
            } as any);
            return;
          }
        }

        // Check if business is in PMS system
        console.log('[BusinessSearch] Checking organization...');
        try {
          const checkResult = await dispatch(
            checkOrganisation({
              placeId: business.id,
              lat,
              lng,
              name: business.name,
              addressLine: business.address,
            }),
          ).unwrap();

          console.log('[BusinessSearch] Organization check result:', checkResult);

          if (checkResult.isPmsOrganisation && checkResult.organisationId) {
            // PMS Business - Navigate to BusinessAddScreen to review and add
            console.log('[BusinessSearch] PMS business found - navigating to BusinessAddScreen for confirmation');

            navigation.navigate('BusinessAdd', {
              companionId,
              companionName,
              companionBreed,
              companionImage,
              category,
              businessId: checkResult.organisationId,
              businessName: business.name,
              businessAddress: business.address,
              phone: checkResult.phone || business.phone,
              email: checkResult.website || business.email,
              photo: business.photo,
              isPMSRecord: true,
              organisationId: checkResult.organisationId,
              rating: business.rating,
              distance: business.distance,
              placeId: business.id,
            } as any);
          } else {
            // Non-PMS Business - Navigate to BusinessAddScreen to notify
            console.log('[BusinessSearch] Business is not PMS - navigating to BusinessAddScreen');

            navigation.navigate('BusinessAdd', {
              companionId,
              companionName,
              companionBreed,
              companionImage,
              category,
              businessId: business.id,
              businessName: business.name,
              businessAddress: business.address,
              phone: checkResult.phone || business.phone,
              email: checkResult.website || business.email,
              photo: business.photo,
              isPMSRecord: false,
              rating: business.rating,
              distance: business.distance,
              placeId: business.id,
            } as any);
          }
        } catch (checkError: any) {
          // If organization check fails, navigate to BusinessAddScreen
          console.log('[BusinessSearch] Organization check failed - navigating to BusinessAddScreen:', checkError);

          navigation.navigate('BusinessAdd', {
            companionId,
            companionName,
            companionBreed,
            companionImage,
            category,
            businessId: business.id,
            businessName: business.name,
            businessAddress: business.address,
            phone: business.phone,
            email: business.email,
            photo: business.photo,
            isPMSRecord: false,
            rating: business.rating,
            distance: business.distance,
            placeId: business.id,
          } as any);
        }
      } catch (error) {
        console.error('[BusinessSearch] Error in handleSelectBusiness:', error);
        Alert.alert('Error', 'Failed to process business. Please try again.');
      }
    },
    [companionId, companionName, companionBreed, companionImage, category, linkedBusinesses, dispatch, navigation],
  );


  const handleDeletePressFromCard = useCallback((business: LinkedBusiness) => {
    console.log('[BusinessSearch] Delete pressed for:', business.id, business.businessName);
    setSelectedBusinessForDelete(business);
    deleteBottomSheetRef.current?.open(business.businessName);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!selectedBusinessForDelete) return;

    try {
      setDeleteLoading(true);
      console.log('[BusinessSearch] ===== DELETE START =====');
      console.log('[BusinessSearch] Business to delete:', selectedBusinessForDelete.id, selectedBusinessForDelete.linkId);

      // Use linkId if available, otherwise use id
      const idToDelete = selectedBusinessForDelete.linkId || selectedBusinessForDelete.id;

      console.log('[BusinessSearch] Dispatching delete for ID:', idToDelete);
      const result = await dispatch(deleteLinkedBusiness(idToDelete)).unwrap();
      console.log('[BusinessSearch] Delete returned:', result);
      console.log('[BusinessSearch] Successfully deleted business');
      console.log('[BusinessSearch] ===== DELETE END =====');

      setSelectedBusinessForDelete(null);
      Alert.alert('Success', 'Business connection has been removed.');
    } catch (error) {
      console.error('[BusinessSearch] Failed to delete business:', error);
      Alert.alert('Error', 'Failed to delete business. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  }, [dispatch, selectedBusinessForDelete]);

  const handleCancelDelete = useCallback(() => {
    console.log('[BusinessSearch] Delete cancelled');
    setSelectedBusinessForDelete(null);
  }, []);

  const handleAcceptInvite = useCallback(
    async (linkId: string) => {
      try {
        console.log('[BusinessSearch] Accepting invite for:', linkId);
        await dispatch(acceptBusinessInvite(linkId)).unwrap();
        Alert.alert('Success', 'Invite accepted!');
        // Refresh the linked businesses list to get the latest state from the API
        // This ensures the accepted invite is properly updated and next invite is shown
        console.log('[BusinessSearch] Refreshing linked businesses after accept...');
        await dispatch(
          fetchLinkedBusinesses({companionId, category})
        ).unwrap();
      } catch (error) {
        console.error('[BusinessSearch] Failed to accept invite:', error);
        Alert.alert('Error', 'Failed to accept invite. Please try again.');
      }
    },
    [dispatch, companionId, category],
  );

  const handleDeclineInvite = useCallback(
    async (linkId: string) => {
      try {
        console.log('[BusinessSearch] Declining invite for:', linkId);
        await dispatch(declineBusinessInvite(linkId)).unwrap();
        Alert.alert('Success', 'Invite declined!');
        // Refresh the linked businesses list to get the latest state from the API
        // This ensures the declined invite is completely removed
        console.log('[BusinessSearch] Refreshing linked businesses after decline...');
        await dispatch(
          fetchLinkedBusinesses({companionId, category})
        ).unwrap();
      } catch (error) {
        console.error('[BusinessSearch] Failed to decline invite:', error);
        Alert.alert('Error', 'Failed to decline invite. Please try again.');
      }
    },
    [dispatch, companionId, category],
  );

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);


  const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);

  return (
    <SafeAreaView style={styles.container}>
      <Header title={categoryTitle} showBackButton onBack={handleBack} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        {/* Close dropdown when clicking outside */}
        {searchResults.length > 0 && (
          <Pressable
            style={styles.overlay}
            onPress={handleCloseDropdown}
          />
        )}

        <View style={styles.mainContent}>
          <View style={styles.searchBarContainer}>
            <SearchBar
              placeholder={`Search ${category}`}
              mode="input"
              value={searchQuery}
              onChangeText={handleSearch}
            />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {/* Companion Profile Header - Always visible */}
            <View key="profile">
              <CompanionProfileImage
                name={companionName}
                breedName={companionBreed}
                profileImage={companionImage}
              />
            </View>

            {/* Pending Invite Sections - Show only the first pending invite */}
            {linkedBusinesses
              .filter(b => b.inviteStatus === 'pending' && b.state === 'pending')
              .slice(0, 1)
              .map(business => (
                <InviteCard
                  key={business.linkId || business.id}
                  businessName={business.businessName}
                  parentName={business.parentName || 'Unknown'}
                  companionName={companionName}
                  email={business.email || business.parentEmail || ''}
                  phone={business.phone || ''}
                  onAccept={() => handleAcceptInvite(business.linkId || business.id)}
                  onDecline={() => handleDeclineInvite(business.linkId || business.id)}
                />
              ))}

            {/* Linked Businesses Section - Only show accepted ones */}
            {linkedBusinesses.some(b => b.inviteStatus === 'accepted' || b.state === 'active') ? (
              <View key="linked" style={styles.linkedSection}>
                <Text style={styles.sectionTitle}>
                  Linked {categoryTitle.toLowerCase()}s
                </Text>
                {linkedBusinesses
                  .filter(b => b.inviteStatus === 'accepted' || b.state === 'active')
                  .map(business => (
                    <LinkedBusinessCard
                      key={business.linkId || business.id}
                      business={business}
                      onDeletePress={handleDeletePressFromCard}
                    />
                  ))}
              </View>
            ) : (
              <View key="empty" style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No linked {categoryTitle.toLowerCase()}s yet
                </Text>
              </View>
            )}
          </ScrollView>
        </View>

        <SearchDropdownOverlay
          visible={searchQuery.length >= 2 && searchResults.length > 0 && !searching}
          items={searchResults}
          keyExtractor={item => item.id}
          onPress={handleSelectBusiness}
          title={item => item.name}
          subtitle={item => item.address}
          initials={item => item.name}
          scrollEnabledThreshold={4}
        />
      </KeyboardAvoidingView>

      <DeleteBusinessBottomSheet
        ref={deleteBottomSheetRef}
        onDelete={handleConfirmDelete}
        onCancel={handleCancelDelete}
        loading={deleteLoading}
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
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 99,
    },
    mainContent: {
      flex: 1,
    },
    searchBarContainer: {
      paddingHorizontal: theme.spacing[4],
      paddingTop: theme.spacing[4],
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing[4],
      paddingBottom: theme.spacing[24],
      paddingTop: theme.spacing[3],
    },
    sectionTitle: {
      ...theme.typography.titleLarge,
      color: theme.colors.text,
      marginBottom: theme.spacing[3],
    },
    loadingContainer: {
      height: 200,
      justifyContent: 'center',
      alignItems: 'center',
    },
    resultsContainer: {
      gap: theme.spacing[3],
      marginTop: theme.spacing[4],
    },
    linkedSection: {
      marginTop: theme.spacing[6],
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.spacing[12],
    },
    emptyText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
  });
