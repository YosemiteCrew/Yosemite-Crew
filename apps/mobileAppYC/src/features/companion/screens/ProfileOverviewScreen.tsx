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
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {
  createGlassCardStyles,
  createScreenContainerStyles,
} from '@/shared/utils/screenStyles';
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
import {selectAuthUser} from '@/features/auth/selectors';
import {selectLinkedBusinesses} from '@/features/linkedBusinesses/selectors';
import {selectTasksByCompanion} from '@/features/tasks/selectors';
import {selectExpenseSummaryByCompanion} from '@/features/expenses';
import {selectCoParents} from '@/features/coParent/selectors';

// Profile Image Picker
import {CompanionProfileHeader} from '@/features/companion/components/CompanionProfileHeader';
import type {ProfileImagePickerRef} from '@/shared/components/common/ProfileImagePicker/ProfileImagePicker';

type ProfileSection = {
  id: string;
  title: string;
  status: 'Complete' | 'Pending';
};

const SECTION_TEMPLATES: Omit<ProfileSection, 'status'>[] = [
  {id: 'overview', title: 'Overview'},
  {id: 'parent', title: 'Parent'},
  {id: 'documents', title: 'Documents'},
  {id: 'hospital', title: 'Hospital'},
  {id: 'boarder', title: 'Boarder'},
  {id: 'breeder', title: 'Breeder'},
  {id: 'groomer', title: 'Groomer'},
  {id: 'expense', title: 'Expense'},
  {id: 'health_tasks', title: 'Health tasks'},
  {id: 'hygiene_tasks', title: 'Hygiene tasks'},
  {id: 'dietary_plan', title: 'Dietary plan tasks'},
  {id: 'custom_tasks', title: 'Custom tasks'},
  {id: 'co_parent', title: 'Co-Parent (Optional)'},
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

  // Get data for status calculations
  const authUser = useSelector(selectAuthUser);
  const linkedBusinesses = useSelector(selectLinkedBusinesses);
  const documents = useSelector((state: RootState) => state.documents?.documents ?? []);
  const tasksSelector = React.useMemo(() => selectTasksByCompanion(companionId), [companionId]);
  const tasks = useSelector(tasksSelector);
  const expenseSummarySelector = React.useMemo(
    () => selectExpenseSummaryByCompanion(companionId),
    [companionId],
  );
  const expenseSummary = useSelector(expenseSummarySelector);
  const coParents = useSelector(selectCoParents);

  // Helper functions to calculate individual section statuses
  const isParentComplete = React.useCallback((parentUser: typeof authUser): boolean => {
    if (!parentUser) return false;
    const hasBasicInfo = !!(parentUser.firstName && parentUser.email);
    const hasAddress = !!(
      parentUser.address?.addressLine ||
      parentUser.address?.city ||
      parentUser.address?.stateProvince ||
      parentUser.address?.postalCode ||
      parentUser.address?.country
    );
    const filledFields = [hasAddress, !!parentUser.phone, !!parentUser.dateOfBirth, !!parentUser.currency].filter(Boolean).length;
    return hasBasicInfo && filledFields >= 2;
  }, []);

  const isBusinessCategoryComplete = React.useCallback((category: string): boolean => {
    return linkedBusinesses.some(b => b.companionId === companionId && b.category === category);
  }, [linkedBusinesses, companionId]);

  const isTaskCategoryComplete = React.useCallback((sectionId: string): boolean => {
    const categoryMap: Record<string, string> = {
      health_tasks: 'health',
      hygiene_tasks: 'hygiene',
      dietary_plan: 'dietary',
      custom_tasks: 'custom',
    };
    const category = categoryMap[sectionId];
    return tasks.some(task => task.category === category);
  }, [tasks]);

  const isCoParentComplete = React.useCallback((): boolean => {
    const userEmail = authUser?.email?.toLowerCase().trim();
    return coParents.some(cp => {
      const cpEmail = cp.email?.toLowerCase().trim();
      return cpEmail && userEmail && cpEmail !== userEmail;
    });
  }, [coParents, authUser]);

  // Calculate section statuses dynamically
  const sections: ProfileSection[] = React.useMemo(() => {
    const calculateStatus = (sectionId: string): 'Complete' | 'Pending' => {
      switch (sectionId) {
        case 'overview':
          return 'Complete';

        case 'parent':
          return isParentComplete(authUser) ? 'Complete' : 'Pending';

        case 'documents':
          return documents.some(doc => doc.companionId === companionId) ? 'Complete' : 'Pending';

        case 'hospital':
        case 'boarder':
        case 'breeder':
        case 'groomer':
          return isBusinessCategoryComplete(sectionId) ? 'Complete' : 'Pending';

        case 'expense':
          return expenseSummary && expenseSummary.total > 0 ? 'Complete' : 'Pending';

        case 'health_tasks':
        case 'hygiene_tasks':
        case 'dietary_plan':
        case 'custom_tasks':
          return isTaskCategoryComplete(sectionId) ? 'Complete' : 'Pending';

        case 'co_parent':
          return isCoParentComplete() ? 'Complete' : 'Pending';

        default:
          return 'Pending';
      }
    };

    return SECTION_TEMPLATES.map(template => ({
      ...template,
      status: calculateStatus(template.id),
    }));
  }, [authUser, documents, companionId, expenseSummary, isParentComplete, isBusinessCategoryComplete, isTaskCategoryComplete, isCoParentComplete]);

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
      case 'documents': {
        if (!guardFeature('documents', 'documents')) {
          return;
        }
        dispatch(setSelectedCompanion(companionId));
        navigation.getParent()?.navigate('Documents', {screen: 'DocumentsMain'});
        break;
      }
      case 'hospital':
      case 'boarder':
      case 'breeder':
      case 'groomer': {
        if (!guardFeature('appointments', 'clinic access')) {
          return;
        }
        navigateToLinkedBusiness(sectionId);
        break;
      }
      case 'expense': {
        if (!guardFeature('expenses', 'expenses')) {
          return;
        }
        dispatch(setSelectedCompanion(companionId));
        navigation.navigate('ExpensesStack', {screen: 'ExpensesMain'});
        break;
      }
      case 'health_tasks': {
        if (!guardFeature('tasks', 'tasks')) {
          return;
        }
        navigateToTasks('health');
        break;
      }
      case 'hygiene_tasks': {
        if (!guardFeature('tasks', 'tasks')) {
          return;
        }
        navigateToTasks('hygiene');
        break;
      }
      case 'dietary_plan': {
        if (!guardFeature('tasks', 'tasks')) {
          return;
        }
        navigateToTasks('dietary');
        break;
      }
      case 'custom_tasks': {
        if (!guardFeature('tasks', 'tasks')) {
          return;
        }
        navigateToTasks('custom');
        break;
      }
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
      <SafeAreaView style={styles.container} edges={[]}>
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
    <>
      <LiquidGlassHeaderScreen
        header={
          <Header
            title={`${companion.name}'s Profile`}
            showBackButton
            onBack={handleBackPress}
            rightIcon={isPrimaryParent ? Images.deleteIconRed : undefined}
            onRightPress={isPrimaryParent ? handleDeletePress : undefined}
            glass={false}
          />
        }
        cardGap={theme.spacing['3']}
        contentPadding={theme.spacing['1']}>
        {contentPaddingStyle => (
          <ScrollView
            contentContainerStyle={[styles.content, contentPaddingStyle]}
            showsVerticalScrollIndicator={false}>
        <CompanionProfileHeader
          name={companion.name}
          breedName={companion.breed?.breedName}
          profileImage={companion.profileImage ?? undefined}
          pickerRef={profileImagePickerRef}
          onImageSelected={handleProfileImageChange}
        />

        {/* Only menu list inside glass card */}
      <View style={styles.glassShadowWrapper}>
        <LiquidGlassCard
          glassEffect="clear"
          interactive
          tintColor={theme.colors.white}
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
        </View>
          </ScrollView>
        )}
      </LiquidGlassHeaderScreen>

      <DeleteProfileBottomSheet
        ref={deleteSheetRef}
        companionName={companion.name}
        onDelete={handleDeleteProfile}
        onCancel={handleDeleteCancel}
      />
    </>
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
    ...createGlassCardStyles(theme),
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
      width: theme.spacing['28'],
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
