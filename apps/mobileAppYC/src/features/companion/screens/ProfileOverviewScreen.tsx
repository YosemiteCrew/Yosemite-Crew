import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet as RNStyleSheet,
  BackHandler,
  Alert,
  ToastAndroid,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {NavigationProp, useFocusEffect, CommonActions} from '@react-navigation/native';
import {useTheme} from '@/hooks';
import {Header} from '@/shared/components/common/Header/Header';
import {GifLoader} from '@/shared/components/common';
import {Images} from '@/assets/images';
import {
  HomeStackParamList,
  type TaskStackParamList,
  type TabParamList,
} from '@/navigation/types';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {createScreenContainerStyles} from '@/shared/utils/screenStyles';
import {createCenteredStyle} from '@/shared/utils/commonHelpers';
import DeleteProfileBottomSheet, {
  type DeleteProfileBottomSheetRef,
} from '@/shared/components/common/DeleteProfileBottomSheet/DeleteProfileBottomSheet';

import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch, RootState} from '@/app/store';
import {
  selectCompanions,
  selectCompanionLoading,
} from '@/features/companion/selectors';
import {deleteCompanion, updateCompanionProfile} from '@/features/companion/thunks';
import {setSelectedCompanion} from '@/features/companion';
import {useAuth} from '@/features/auth/context/AuthContext';
import type {Companion} from '@/features/companion/types';

// Profile Image Picker
import {CompanionProfileHeader} from '@/features/companion/components/CompanionProfileHeader';
import type {ProfileImagePickerRef} from '@/shared/components/common/ProfileImagePicker/ProfileImagePicker';

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
  {id: 'dietary_plan', title: 'Dietary plan tasks', status: 'Pending'},
  {id: 'custom_tasks', title: 'Custom tasks', status: 'Pending'},
  {id: 'co_parent', title: 'Co-Parent (Optional)', status: 'Pending'},
];

type Props = NativeStackScreenProps<HomeStackParamList, 'ProfileOverview'>;

export const ProfileOverviewScreen: React.FC<Props> = ({route, navigation}) => {
  const {companionId} = route.params;
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const deleteSheetRef = React.useRef<DeleteProfileBottomSheetRef>(null);
  const [isDeleteSheetOpen, setIsDeleteSheetOpen] = useState(false);
  const accessMap = useSelector((state: RootState) => state.coParent?.accessByCompanionId ?? {});
  const defaultAccess = useSelector((state: RootState) => state.coParent?.defaultAccess ?? null);
  const globalRole = useSelector((state: RootState) => state.coParent?.lastFetchedRole);
  const accessForCompanion = companionId
    ? accessMap[companionId] ?? defaultAccess
    : defaultAccess;
  const isPrimaryParent = (accessForCompanion?.role ?? globalRole ?? '').toUpperCase().includes('PRIMARY');

  // Profile image picker ref
  const profileImagePickerRef = React.useRef<ProfileImagePickerRef | null>(null);

  const dispatch = useDispatch<AppDispatch>();
  const {user} = useAuth();
  const parentId = user?.parentId;

  const allCompanions = useSelector(selectCompanions);
  const isLoading = useSelector(selectCompanionLoading);

  const companion = React.useMemo(
    () => allCompanions.find(c => c.id === companionId),
    [allCompanions, companionId],
  );

  const showPermissionToast = React.useCallback((label: string) => {
    const message = `You don't have access to ${label}. Ask the primary parent to enable it.`;
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('Permission needed', message);
    }
  }, []);

  const canAccessFeature = React.useCallback(
    (permission: keyof NonNullable<typeof accessForCompanion>['permissions']) => {
      if (isPrimaryParent) {
        return true;
      }
      if (!accessForCompanion) {
        return true;
      }
      return Boolean(accessForCompanion.permissions?.[permission]);
    },
    [accessForCompanion, isPrimaryParent],
  );

  const guardFeature = React.useCallback(
    (permission: keyof NonNullable<typeof accessForCompanion>['permissions'], label: string) => {
      if (!canAccessFeature(permission)) {
        showPermissionToast(label);
        return false;
      }
      return true;
    },
    [canAccessFeature, showPermissionToast],
  );

  useEffect(() => {
    if (companionId) {
      dispatch(setSelectedCompanion(companionId));
    }
  }, [companionId, dispatch]);

  // When returning to this screen, reset the Tasks tab stack to its root
  useFocusEffect(
    React.useCallback(() => {
      const tabNavigation = navigation.getParent<NavigationProp<TabParamList>>();
      try {
        const tabState = tabNavigation?.getState();
        const tasksRoute: any = tabState?.routes?.find(r => r.name === 'Tasks');
        const nestedState = tasksRoute?.state;
        const targetKey = nestedState?.key; // key of the nested Tasks stack
        if (targetKey) {
          // Hard reset the nested Tasks stack to ensure TasksMain is the root
          tabNavigation?.dispatch({
            ...CommonActions.reset({
              index: 0,
              routes: [{name: 'TasksMain'}],
            }),
            target: targetKey as string,
          });
        }
      } catch {
        // no-op: if state isn't available yet, nothing to reset
      }
      return undefined;
    }, [navigation])
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

        if (!parentId) {
          throw new Error('Parent profile missing. Please sign in again.');
        }

        await dispatch(
          updateCompanionProfile({
            parentId,
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
    [companion, dispatch, parentId, showErrorAlert],
  );

  // Handler for navigating to the Edit Screen
  const navigateToTasks = (
    category: TaskStackParamList['TasksList']['category'],
  ) => {
    dispatch(setSelectedCompanion(companionId));
    const tabNavigation =
      navigation.getParent<NavigationProp<TabParamList>>();
    tabNavigation?.navigate('Tasks', {
      screen: 'TasksList',
      params: {category},
    } as any);
  };

  const handleSectionPress = (sectionId: string) => {
    const navigateToLinkedBusiness = (
      category: 'hospital' | 'boarder' | 'breeder' | 'groomer',
    ) =>
      navigation.navigate('LinkedBusinesses', {
        screen: 'BusinessSearch',
        params: {
          companionId,
          companionName: companion?.name || '',
          companionBreed: companion?.breed?.breedName,
          companionImage: companion?.profileImage,
          category,
        },
      } as any);

    switch (sectionId) {
      case 'overview':
        navigation.navigate('EditCompanionOverview', {companionId});
        break;
      case 'parent':
        navigation.navigate('EditParentOverview', {companionId});
        break;
      case 'documents':
        if (!guardFeature('documents', 'documents')) {
          return;
        }
        dispatch(setSelectedCompanion(companionId));
        navigation.getParent()?.navigate('Documents', {screen: 'DocumentsMain'});
        break;
      case 'hospital':
      case 'boarder':
      case 'breeder':
      case 'groomer':
        if (!guardFeature('appointments', 'clinic access')) {
          return;
        }
        navigateToLinkedBusiness(sectionId);
        break;
      case 'expense':
        if (!guardFeature('expenses', 'expenses')) {
          return;
        }
        dispatch(setSelectedCompanion(companionId));
        navigation.navigate('ExpensesStack', {screen: 'ExpensesMain'});
        break;
      case 'health_tasks':
        if (!guardFeature('tasks', 'tasks')) {
          return;
        }
        navigateToTasks('health');
        break;
      case 'hygiene_tasks':
        if (!guardFeature('tasks', 'tasks')) {
          return;
        }
        navigateToTasks('hygiene');
        break;
      case 'dietary_plan':
        if (!guardFeature('tasks', 'tasks')) {
          return;
        }
        navigateToTasks('dietary');
        break;
      case 'custom_tasks':
        if (!guardFeature('tasks', 'tasks')) {
          return;
        }
        navigateToTasks('custom');
        break;
      case 'co_parent':
        navigation.navigate('CoParents');
        break;
      default:
        break;
    }
  };

  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  // Handle Android back button for delete bottom sheet
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isDeleteSheetOpen) {
        deleteSheetRef.current?.close();
        setIsDeleteSheetOpen(false);
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [isDeleteSheetOpen]);

  const handleDeletePress = React.useCallback(() => {
    setIsDeleteSheetOpen(true);
    deleteSheetRef.current?.open();
  }, []);

  const handleDeleteProfile = React.useCallback(async () => {
    if (!parentId || !companion?.id) return;

    try {
      console.log('[ProfileOverview] Deleting companion:', companion.id);
      const resultAction = await dispatch(
        deleteCompanion({parentId, companionId: companion.id}),
      );

      if (deleteCompanion.fulfilled.match(resultAction)) {
        console.log('[ProfileOverview] Companion deleted successfully');
        setIsDeleteSheetOpen(false);
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
  }, [companion?.id, dispatch, navigation, parentId, showErrorAlert]);

  const handleDeleteCancel = React.useCallback(() => {
    setIsDeleteSheetOpen(false);
  }, []);

  if (!companion) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Profile" showBackButton onBack={handleBackPress} />
        <View style={styles.centered}>
          {isLoading ? (
            <GifLoader />
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
        rightIcon={isPrimaryParent ? Images.deleteIconRed : undefined}
        onRightPress={isPrimaryParent ? handleDeletePress : undefined}
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
        onCancel={handleDeleteCancel}
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
      paddingHorizontal: theme.spacing['5'],
      paddingBottom: theme.spacing['10'],
    },
    glassContainer: {
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing['2'],
      overflow: 'hidden',
      ...theme.shadows.md,
    },
    glassFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderColor: theme.colors.borderMuted,
    },
    listContainer: {
      gap: theme.spacing['1'],
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing['3'],
      paddingHorizontal: theme.spacing['3'],
    },
    rowTitle: {
      ...theme.typography.paragraphBold,
      color: theme.colors.secondary,
      flex: 1,
    },
    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
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
      paddingHorizontal: theme.spacing['3'],
      paddingVertical: theme.spacing['2'],
      borderRadius: theme.borderRadius.lg,
    },
    pendingBadge: {
      backgroundColor: theme.colors.warning + '20',
    },
    completeBadge: {
      backgroundColor: theme.colors.success + '20',
    },
    statusText: {
      ...theme.typography.labelSmall,
      textAlign: 'center',
    },
    pendingText: {
      color: theme.colors.warning,
    },
    completeText: {
      color: theme.colors.success,
    },
    rightArrow: {
      width: theme.spacing['4'],
      height: theme.spacing['4'],
      resizeMode: 'contain',
    },
  });
