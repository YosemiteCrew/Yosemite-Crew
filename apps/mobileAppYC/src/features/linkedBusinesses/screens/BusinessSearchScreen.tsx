import React, {useState, useCallback, useMemo} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch, RootState} from '@/app/store';
import {useTheme} from '@/hooks';
import {Header} from '@/shared/components/common/Header/Header';
import {SearchBar} from '@/shared/components/common/SearchBar/SearchBar';
import {
  searchBusinessesByLocation,
  selectLinkedBusinessesLoading,
  selectLinkedBusinessesByCompanion,
  deleteLinkedBusiness,
  addLinkedBusiness,
} from '../index';
import {BusinessSearchResult} from '../components/BusinessSearchResult';
import {LinkedBusinessCard} from '../components/LinkedBusinessCard';
import type {LinkedBusinessStackParamList} from '@/navigation/types';
import {AddBusinessBottomSheet, type AddBusinessBottomSheetRef} from '../components/AddBusinessBottomSheet';
import {NotifyBusinessBottomSheet, type NotifyBusinessBottomSheetRef} from '../components/NotifyBusinessBottomSheet';
import {CompanionProfileImage} from '../components/CompanionProfileImage';
import {InviteCard} from '../components/InviteCard';

type Props = NativeStackScreenProps<LinkedBusinessStackParamList, 'BusinessSearch'>;

export const BusinessSearchScreen: React.FC<Props> = ({route, navigation}) => {
  const {companionId, companionName, companionBreed, companionImage, category} =
    route.params;
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();
  const loading = useSelector(selectLinkedBusinessesLoading);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<any>(null);

  // Get linked businesses for this companion and category
  const linkedBusinesses = useSelector((state: RootState) => {
    const selectByCompanion = selectLinkedBusinessesByCompanion(companionId);
    const all = selectByCompanion(state);
    return all.filter(b => b.category === category);
  });

  const addBusinessSheetRef = React.useRef<AddBusinessBottomSheetRef>(null);
  const notifyBusinessSheetRef = React.useRef<NotifyBusinessBottomSheetRef>(null);

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      if (query.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const result = await dispatch(
          searchBusinessesByLocation({query, location: null}),
        ).unwrap();
        setSearchResults(result);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    [dispatch],
  );

  const handleSelectBusiness = useCallback(
    (business: any) => {
      setSelectedBusiness(business);
      addBusinessSheetRef.current?.open();
    },
    [],
  );

  const handleAddBusiness = useCallback(async () => {
    if (!selectedBusiness) return;
    try {
      await dispatch(
        addLinkedBusiness({
          companionId,
          businessId: selectedBusiness.businessId,
          businessName: selectedBusiness.name,
          category: category as any,
        }),
      ).unwrap();

      addBusinessSheetRef.current?.close();
      // Show notification bottom sheet
      notifyBusinessSheetRef.current?.open();
    } catch (error) {
      console.error('Failed to add business:', error);
      Alert.alert('Error', 'Failed to add business. Please try again.');
    }
  }, [dispatch, selectedBusiness, companionId, category]);

  const handleNotifyClose = useCallback(() => {
    notifyBusinessSheetRef.current?.close();
    setSearchQuery('');
    setSearchResults([]);
    setSelectedBusiness(null);
  }, []);

  const handleDeleteBusiness = useCallback(
    (id: string) => {
      dispatch(deleteLinkedBusiness(id));
    },
    [dispatch],
  );

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handleSheetChange = useCallback((_index: number) => {
    // Unused but required by bottom sheet component
  }, []);

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
              autoFocus
            />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {/* Companion Profile Header */}
            {!searchQuery && (
              <CompanionProfileImage
                name={companionName}
                breedName={companionBreed}
                profileImage={companionImage}
              />
            )}

            {/* Mock Invite Section - Always Show */}
            {!searchQuery && (
              <InviteCard
                businessName="San Francisco Pet Health Center"
                parentName="Sky Brown"
                companionName={companionName}
                email="skybrown@gmail.com"
                phone="+91-9546284920"
                onAccept={() => {}}
                onDecline={() => {}}
              />
            )}

            {/* Search Results */}
            {searching || loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
              </View>
            ) : searchResults.length > 0 && searchQuery ? (
              <View style={styles.resultsContainer}>
                <Text style={styles.sectionTitle}>Search results</Text>
                {searchResults.map(result => (
                  <BusinessSearchResult
                    key={result.id}
                    business={result}
                    onPress={() => handleSelectBusiness(result)}
                  />
                ))}
              </View>
            ) : null}

            {/* Linked Businesses Section */}
            {linkedBusinesses.length > 0 && (
              <View style={styles.linkedSection}>
                <Text style={styles.sectionTitle}>
                  Linked {categoryTitle.toLowerCase()}s
                </Text>
                {linkedBusinesses.map(business => (
                  <LinkedBusinessCard
                    key={business.id}
                    business={business}
                    onDelete={handleDeleteBusiness}
                  />
                ))}
              </View>
            )}

            {!searchQuery && linkedBusinesses.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No linked {categoryTitle.toLowerCase()}s yet
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Add Business Bottom Sheet */}
      <AddBusinessBottomSheet
        ref={addBusinessSheetRef}
        businessName={selectedBusiness?.name}
        businessAddress={selectedBusiness?.address}
        onConfirm={handleAddBusiness}
        onSheetChange={handleSheetChange}
      />

      {/* Notify Business Bottom Sheet */}
      <NotifyBusinessBottomSheet
        ref={notifyBusinessSheetRef}
        businessName={selectedBusiness?.name}
        companionName={companionName}
        onConfirm={handleNotifyClose}
        onSheetChange={handleSheetChange}
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
      paddingVertical: theme.spacing[4],
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing[4],
      paddingBottom: theme.spacing[24],
      paddingTop: theme.spacing[3],
    },
    sectionTitle: {
      ...theme.typography.h4,
      color: theme.colors.text,
      marginBottom: theme.spacing[3],
      marginTop: theme.spacing[2],
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
