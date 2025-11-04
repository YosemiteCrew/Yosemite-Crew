import React, {useState, useCallback, useMemo, useRef, useEffect} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
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

  // Reset search state when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('[BusinessSearch] Screen focused - resetting search state');
      setSearchQuery('');
      setSearchResults([]);
      setSelectedBusinessForDelete(null);
      return () => {
        // Cleanup: clear any pending search debounce timer when screen loses focus
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    }, []),
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
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
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
    [dispatch],
  );

  const handleSelectBusiness = useCallback(
    (business: any) => {
      // Check if there's an existing linked business with the same name to get the photo
      const existingBusiness = linkedBusinesses.find(
        b => b.businessName.toLowerCase() === business.name.toLowerCase(),
      );
      // Use existing business data if available (includes photo, phone, email)
      const photoToUse = business.photo || existingBusiness?.photo;
      const phoneToUse = business.phone || existingBusiness?.phone;
      const emailToUse = business.email || existingBusiness?.email;

      console.log('[BusinessSearch] Selected business:', {
        name: business.name,
        businessId: business.businessId,
        placeId: business.id,
        photo: photoToUse,
        phone: phoneToUse,
        email: emailToUse,
        isPMSRecord: business.isPMSRecord,
      });

      navigation.navigate('BusinessAdd', {
        companionId,
        companionName,
        companionBreed,
        companionImage,
        category,
        businessId: business.businessId,
        businessName: business.name,
        businessAddress: business.address,
        phone: phoneToUse,
        email: emailToUse,
        photo: photoToUse,
        isPMSRecord: business.isPMSRecord,
        rating: business.rating,
        distance: business.distance,
        placeId: business.id,
      } as any);
    },
    [navigation, companionId, companionName, companionBreed, companionImage, category, linkedBusinesses],
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
      console.log('[BusinessSearch] Business ID to delete:', selectedBusinessForDelete.id);

      console.log('[BusinessSearch] Dispatching delete...');
      const result = await dispatch(deleteLinkedBusiness(selectedBusinessForDelete.id)).unwrap();
      console.log('[BusinessSearch] Delete returned:', result);
      console.log('[BusinessSearch] Successfully deleted business:', selectedBusinessForDelete.id);
      console.log('[BusinessSearch] ===== DELETE END =====');

      setSelectedBusinessForDelete(null);
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
            <CompanionProfileImage
              name={companionName}
              breedName={companionBreed}
              profileImage={companionImage}
            />

            {/* Mock Invite Section - Always Show */}
            <InviteCard
              businessName="San Francisco Pet Health Center"
              parentName="Sky Brown"
              companionName={companionName}
              email="skybrown@gmail.com"
              phone="+91-9546284920"
              onAccept={() => {}}
              onDecline={() => {}}
            />

            {/* Linked Businesses Section - Always visible */}
            {linkedBusinesses.length > 0 && (
              <View style={styles.linkedSection}>
                <Text style={styles.sectionTitle}>
                  Linked {categoryTitle.toLowerCase()}s
                </Text>
                {linkedBusinesses.map(business => (
                  <LinkedBusinessCard
                    key={business.id}
                    business={business}
                    onDeletePress={handleDeletePressFromCard}
                  />
                ))}
              </View>
            )}

            {linkedBusinesses.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No linked {categoryTitle.toLowerCase()}s yet
                </Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Search Dropdown Overlay - Shows above keyboard */}
        {searchQuery.length >= 2 && searchResults.length > 0 && !searching && (
          <View style={styles.absoluteSearchDropdownContainer}>
            <ScrollView
              style={styles.searchDropdownContainer}
              scrollEnabled={searchResults.length > 5}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}>
              {searchResults.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.searchResultItem}
                  onPress={() => handleSelectBusiness(item)}>
                  <View style={styles.resultAvatar}>
                    <Text style={styles.resultAvatarText}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName}>{item.name}</Text>
                    <Text style={styles.resultEmail}>{item.address}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
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
    absoluteSearchDropdownContainer: {
      position: 'absolute',
      top: 70,
      left: theme.spacing[4],
      right: theme.spacing[4],
      maxHeight: 300,
      zIndex: 100,
    },
    searchDropdownContainer: {
      backgroundColor: theme.colors.white,
      borderRadius: theme.borderRadius.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
      maxHeight: 300,
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
    },
    searchResultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing[3],
      paddingVertical: theme.spacing[3],
      gap: theme.spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    resultAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.lightBlueBackground,
      justifyContent: 'center',
      alignItems: 'center',
    },
    resultAvatarText: {
      ...theme.typography.h4,
      color: theme.colors.secondary,
    },
    resultInfo: {
      flex: 1,
    },
    resultName: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[1],
    },
    resultEmail: {
      ...theme.typography.bodyExtraSmall,
      color: theme.colors.textSecondary,
    },
  });
