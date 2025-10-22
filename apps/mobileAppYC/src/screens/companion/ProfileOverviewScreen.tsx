import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet as RNStyleSheet,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '@/hooks';
import {Header} from '@/components';
import {Images} from '@/assets/images';
import {HomeStackParamList} from '@/navigation/types';
import {LiquidGlassCard} from '@/components/common/LiquidGlassCard/LiquidGlassCard';
import {createScreenContainerStyles} from '@/utils/screenStyles';
import {createCenteredStyle} from '@/utils/commonHelpers';
import DeleteProfileBottomSheet, {
  type DeleteProfileBottomSheetRef,
} from '../../components/common/DeleteProfileBottomSheet/DeleteProfileBottomSheet';

import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch} from '@/app/store';
import {
  selectCompanions,
  selectCompanionLoading,
} from '@/features/companion/selectors';
import {deleteCompanion, updateCompanionProfile} from '@/features/companion/thunks';
import {setSelectedCompanion} from '@/features/companion';
import {useAuth} from '@/contexts/AuthContext';
import type {Companion} from '@/features/companion/types';

// Profile Image Picker
import {CompanionProfileHeader} from '@/components/companion/CompanionProfileHeader';
import type {ProfileImagePickerRef} from '@/components/common/ProfileImagePicker/ProfileImagePicker';

type ProfileSection = {
  id: string;
  title: string;
  status: 'Complete' | 'Pending';
};

const sections: ProfileSection[] = [
  {id: 'overview', title: 'Overview', status: 'Complete'},
  {id: 'parent', title: 'Parent', status: 'Complete'},
  {id: 'documents', title: 'Documents', status: 'Pending'},
  {id: 'hospital', title: 'Hospital', status: 'Pending'},
  {id: 'boarder', title: 'Boarder', status: 'Pending'},
  {id: 'breeder', title: 'Breeder', status: 'Pending'},
  {id: 'groomer', title: 'Groomer', status: 'Pending'},
  {id: 'expense', title: 'Expense', status: 'Pending'},
  {id: 'health_tasks', title: 'Health tasks', status: 'Pending'},
  {id: 'hygiene_tasks', title: 'Hygiene tasks', status: 'Pending'},
  {id: 'dietary_plan', title: 'Dietary Plan tasks', status: 'Pending'},
  {id: 'co_parent', title: 'Co-Parent (Optional)', status: 'Pending'},
];

type Props = NativeStackScreenProps<HomeStackParamList, 'ProfileOverview'>;

export const ProfileOverviewScreen: React.FC<Props> = ({route, navigation}) => {
  const {companionId} = route.params;
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const deleteSheetRef = React.useRef<DeleteProfileBottomSheetRef>(null);

  // Profile image picker ref
  const profileImagePickerRef = React.useRef<ProfileImagePickerRef | null>(null);

  const dispatch = useDispatch<AppDispatch>();
  const {user} = useAuth();

  const allCompanions = useSelector(selectCompanions);
  const isLoading = useSelector(selectCompanionLoading);

  const companion = React.useMemo(
    () => allCompanions.find(c => c.id === companionId),
    [allCompanions, companionId],
  );

  // Helper to show error alerts
  const showErrorAlert = React.useCallback((title: string, message: string) => {
    Alert.alert(title, message, [{text: 'OK'}]);
  }, []);

  const handleProfileImageChange = React.useCallback(
    async (imageUri: string | null) => {
      if (!companion?.id) return;

      try {
        console.log('[ProfileOverview] Profile image change:', imageUri);
        const updated: Companion = {
          ...companion,
          profileImage: imageUri || null,
          updatedAt: new Date().toISOString(),
        };

        await dispatch(
          updateCompanionProfile({
            userId: user?.id || '',
            updatedCompanion: updated,
          }),
        ).unwrap();

        console.log('[ProfileOverview] Profile image updated successfully');
      } catch (error) {
        console.error('[ProfileOverview] Failed to update profile image:', error);
        showErrorAlert(
          'Image Update Failed',
          'Failed to update profile image. Please try again.'
        );
      }
    },
    [companion, dispatch, user?.id, showErrorAlert],
  );

  // Handler for navigating to the Edit Screen
  const handleSectionPress = (sectionId: string) => {
    if (sectionId === 'overview') {
      navigation.navigate('EditCompanionOverview', {companionId});
    }
    if (sectionId === 'parent') {
      navigation.navigate('EditParentOverview', {companionId});
    }
    if (sectionId === 'expense') {
      dispatch(setSelectedCompanion(companionId));
      navigation.navigate('ExpensesStack', {
        screen: 'ExpensesMain',
      });
    }
    // Add logic for other sections here
  };

  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleDeletePress = () => {
    deleteSheetRef.current?.open();
  };

  const handleDeleteProfile = async () => {
    if (!user?.id || !companion?.id) return;

    try {
      console.log('[ProfileOverview] Deleting companion:', companion.id);
      const resultAction = await dispatch(
        deleteCompanion({userId: user.id, companionId: companion.id}),
      );

      if (deleteCompanion.fulfilled.match(resultAction)) {
        console.log('[ProfileOverview] Companion deleted successfully');
        navigation.goBack();
      } else {
        console.error('[ProfileOverview] Failed to delete companion:', resultAction.payload);
        showErrorAlert(
          'Delete Failed',
          'Failed to delete companion profile. Please try again.'
        );
      }
    } catch (error) {
      console.error('[ProfileOverview] Error deleting companion:', error);
      showErrorAlert(
        'Delete Failed',
        'An error occurred while deleting the companion profile.'
      );
    }
  };

  if (!companion) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Profile" showBackButton onBack={handleBackPress} />
        <View style={styles.centered}>
          {isLoading ? (
            <ActivityIndicator size="large" color={theme.colors.primary} />
          ) : (
            <Text style={styles.emptyStateText}>Companion not found.</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={`${companion.name}'s Profile`}
        showBackButton
        onBack={handleBackPress}
        rightIcon={Images.deleteIconRed}
        onRightPress={handleDeletePress}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <CompanionProfileHeader
          name={companion.name}
          breedName={companion.breed?.breedName}
          profileImage={companion.profileImage ?? undefined}
          pickerRef={profileImagePickerRef}
          onImageSelected={handleProfileImageChange}
        />

        {/* Only menu list inside glass card */}
        <LiquidGlassCard
          glassEffect="clear"
          interactive
          style={styles.glassContainer}
          fallbackStyle={styles.glassFallback}>
          <View style={styles.listContainer}>
            {sections.map((item, index) => (
              <TouchableOpacity key={item.id} style={styles.row} activeOpacity={0.7}    onPress={() => handleSectionPress(item.id)}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <View style={styles.rowRight}>
                  <View
                    style={[
                      styles.statusBadge,
                      item.status === 'Complete'
                        ? styles.completeBadge
                        : styles.pendingBadge,
                    ]}>
                    <Text
                      style={[
                        styles.statusText,
                        item.status === 'Complete'
                          ? styles.completeText
                          : styles.pendingText,
                      ]}>
                      {item.status}
                    </Text>
                  </View>
                  <Image source={Images.rightArrow} style={styles.rightArrow} />
                </View>
                {/* Add separator except for last item */}
                {index !== sections.length - 1 && (
                  <View style={styles.separator} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </LiquidGlassCard>
      </ScrollView>

      <DeleteProfileBottomSheet
        ref={deleteSheetRef}
        companionName={companion.name}
        onDelete={handleDeleteProfile}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    ...createScreenContainerStyles(theme),
    ...createCenteredStyle(theme),
    emptyStateText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
    content: {
      paddingHorizontal: theme.spacing[5],
      paddingBottom: theme.spacing[10],
    },
    glassContainer: {
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing[2],
      overflow: 'hidden',
      ...theme.shadows.md,
    },
    glassFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderColor: theme.colors.borderMuted,
    },
    listContainer: {
      gap: theme.spacing[1],
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing[3],
      paddingHorizontal: theme.spacing[3],
    },
    rowTitle: {
      ...theme.typography.paragraphBold,
      color: theme.colors.secondary,
      flex: 1,
    },
    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
    },
    separator: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      borderBottomWidth: RNStyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.borderSeperator,
    },
    statusBadge: {
      paddingHorizontal: theme.spacing[3],
      paddingVertical: theme.spacing[2],
      borderRadius: 16,
    },
    pendingBadge: {
      backgroundColor: '#FEF3E9',
    },
    completeBadge: {
      backgroundColor: '#E6F4EF',
    },
    statusText: {
      fontFamily: 'Satoshi',
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 16.8,
      textAlign: 'center',
    },
    pendingText: {
      color: '#F89D4F',
    },
    completeText: {
      color: '#54B492',
    },
    rightArrow: {
      width: 16,
      height: 16,
      resizeMode: 'contain',
    },
  });
