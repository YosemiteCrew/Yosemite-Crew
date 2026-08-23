import React, {useEffect as useReactEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  BackHandler,
  Alert,
  ToastAndroid,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {IconTile} from '@/shared/components/common/IconTile/IconTile';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  NavigationProp,
  useFocusEffect,
  CommonActions,
} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';
import {Header} from '@/shared/components/common/Header/Header';
import {GifLoader} from '@/shared/components/common';
import {Images} from '@/assets/images';
import {
  HomeStackParamList,
  type TaskStackParamList,
  type TabParamList,
} from '@/navigation/types';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
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
import {
  deleteCompanion,
  updateCompanionProfile,
} from '@/features/companion/thunks';
import {setSelectedCompanion} from '@/features/companion';
import {useAuth} from '@/features/auth/context/AuthContext';
import type {Companion} from '@/features/companion/types';
import {selectCoParents} from '@/features/coParent/selectors';

// Profile Image Picker
import {CompanionProfileHeader} from '@/features/companion/components/CompanionProfileHeader';
import type {ProfileImagePickerRef} from '@/shared/components/common/ProfileImagePicker/ProfileImagePicker';

import i18next from 'i18next';
type ProfileSection = {
  id: string;
  title: string;
  // Localisation key for the tile label. The remaining tiles still carry raw
  // English copy from an earlier iteration of this screen; each one gains a
  // `titleKey` as its translations land.
  titleKey?: string;
};

// Per-tile visual language taken from the "Companion profile hub" handoff:
// an Ionicon glyph on a tinted rounded-square, cycling the warm-bone accent
// surfaces (blue / violet / amber / green / pink) exactly as the design does.
type SectionVisual = {
  icon: string;
  bg: keyof Theme['colors'];
  ink: keyof Theme['colors'];
};

const SECTION_VISUALS: Record<string, SectionVisual> = {
  overview: {icon: 'reader-outline', bg: 'blueSoft', ink: 'blueText'},
  parent: {
    icon: 'person-outline',
    bg: 'avatarVioletBg',
    ink: 'avatarVioletInk',
  },
  passport: {
    icon: 'id-card-outline',
    bg: 'avatarAmberBg',
    ink: 'avatarAmberInk',
  },
  documents: {
    icon: 'folder-open-outline',
    bg: 'avatarAmberBg',
    ink: 'avatarAmberInk',
  },
  hospital: {icon: 'business-outline', bg: 'blueSoft', ink: 'blueText'},
  boarder: {icon: 'bed-outline', bg: 'avatarGreenBg', ink: 'avatarGreenInk'},
  breeder: {
    icon: 'ribbon-outline',
    bg: 'avatarVioletBg',
    ink: 'avatarVioletInk',
  },
  groomer: {icon: 'cut-outline', bg: 'pinkGlow', ink: 'pink'},
  expense: {icon: 'wallet-outline', bg: 'avatarGreenBg', ink: 'avatarGreenInk'},
  health_tasks: {icon: 'medkit-outline', bg: 'blueSoft', ink: 'blueText'},
  hygiene_tasks: {
    icon: 'sparkles-outline',
    bg: 'avatarVioletBg',
    ink: 'avatarVioletInk',
  },
  dietary_plan: {
    icon: 'nutrition-outline',
    bg: 'avatarAmberBg',
    ink: 'avatarAmberInk',
  },
  custom_tasks: {
    icon: 'checkbox-outline',
    bg: 'avatarGreenBg',
    ink: 'avatarGreenInk',
  },
  co_parent: {icon: 'people-outline', bg: 'pinkGlow', ink: 'pink'},
};

const SECTION_TEMPLATES: ProfileSection[] = [
  {id: 'overview', title: 'Overview'},
  {id: 'parent', title: 'Parent'},
  {id: 'passport', title: 'Pet Passport', titleKey: 'passport.title'},
  {id: 'documents', title: 'Documents'},
  {id: 'hospital', title: 'Hospital'},
  {id: 'boarder', title: 'Boarder'},
  {id: 'breeder', title: 'Breeder'},
  {id: 'groomer', title: 'Groomer'},
  {id: 'expense', title: 'Expenses'},
  {id: 'health_tasks', title: 'Health tasks'},
  {id: 'hygiene_tasks', title: 'Hygiene tasks'},
  {id: 'dietary_plan', title: 'Dietary plans'},
  {id: 'custom_tasks', title: 'Custom tasks'},
  {id: 'co_parent', title: 'Co-parents'},
];

type Props = NativeStackScreenProps<HomeStackParamList, 'ProfileOverview'>;

export const ProfileOverviewScreen: React.FC<Props> = ({route, navigation}) => {
  const {companionId} = route.params;
  const {t} = useTranslation();
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const deleteSheetRef = React.useRef<DeleteProfileBottomSheetRef>(null);
  const isDeleteSheetOpenRef = React.useRef(false);
  const accessMap = useSelector(
    (state: RootState) => state.coParent?.accessByCompanionId ?? {},
  );
  const defaultAccess = useSelector(
    (state: RootState) => state.coParent?.defaultAccess ?? null,
  );
  const globalRole = useSelector(
    (state: RootState) => state.coParent?.lastFetchedRole,
  );
  const accessForCompanion = companionId
    ? (accessMap[companionId] ?? defaultAccess)
    : defaultAccess;
  const isPrimaryParent = (accessForCompanion?.role ?? globalRole ?? '')
    .toUpperCase()
    .includes('PRIMARY');

  // Profile image picker ref
  const profileImagePickerRef = React.useRef<ProfileImagePickerRef | null>(
    null,
  );

  const dispatch = useDispatch<AppDispatch>();
  const {user} = useAuth();
  const parentId = user?.parentId;

  const allCompanions = useSelector(selectCompanions);
  const isLoading = useSelector(selectCompanionLoading);

  const companion = React.useMemo(
    () => allCompanions.find(c => c.id === companionId),
    [allCompanions, companionId],
  );

  const coParents = useSelector(selectCoParents);

  // Small stacked avatars shown on the Co-parents tile (design shows up to two).
  // Derived defensively from the already-selected co-parent list.
  const coParentAvatars = React.useMemo(
    () =>
      (coParents ?? []).slice(0, 2).map((cp, index) => {
        const initials =
          `${cp?.firstName?.charAt(0) ?? ''}${cp?.lastName?.charAt(0) ?? ''}`.toUpperCase() ||
          (cp?.email?.charAt(0)?.toUpperCase() ?? '?');
        return {key: cp?.id ?? `co-parent-${index}`, initials, index};
      }),
    [coParents],
  );

  // The profile hub is a flat grid of tinted icon tiles (Overview, Parent,
  // Documents, …, Co-parents). The warm-bone design intentionally carries no
  // per-tile completion affordance, so the tiles render straight from the
  // static template list, with any localised label resolved through t().
  const sections = React.useMemo(
    () =>
      SECTION_TEMPLATES.map(section =>
        section.titleKey ? {...section, title: t(section.titleKey)} : section,
      ),
    [t],
  );

  const showPermissionToast = React.useCallback((label: string) => {
    const message = `You don't have access to ${label}. Ask the primary parent to enable it.`;
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert(i18next.t('alerts.shared.permissionNeeded'), message);
    }
  }, []);

  const canAccessFeature = React.useCallback(
    (
      permission: keyof NonNullable<typeof accessForCompanion>['permissions'],
    ) => {
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
    (
      permission: keyof NonNullable<typeof accessForCompanion>['permissions'],
      label: string,
    ) => {
      if (!canAccessFeature(permission)) {
        showPermissionToast(label);
        return false;
      }
      return true;
    },
    [canAccessFeature, showPermissionToast],
  );

  useReactEffect(() => {
    if (companionId) {
      dispatch(setSelectedCompanion(companionId));
    }
  }, [companionId, dispatch]);

  // When returning to this screen, reset the Tasks tab stack to its root
  useFocusEffect(
    React.useCallback(() => {
      const tabNavigation =
        navigation.getParent<NavigationProp<TabParamList>>();
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
    }, [navigation]),
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
        console.error(
          '[ProfileOverview] Failed to update profile image:',
          error,
        );
        showErrorAlert(
          'Image Update Failed',
          'Failed to update profile image. Please try again.',
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
    const tabNavigation = navigation.getParent<NavigationProp<TabParamList>>();
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
      case 'passport':
        navigation.navigate('Passport', {companionId});
        break;
      case 'documents': {
        if (!guardFeature('documents', 'documents')) {
          return;
        }
        dispatch(setSelectedCompanion(companionId));
        navigation
          .getParent()
          ?.navigate('Documents', {screen: 'DocumentsMain'});
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
      /* istanbul ignore next -- unreachable: every rendered section id has an explicit case */
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
  useReactEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (isDeleteSheetOpenRef.current) {
          deleteSheetRef.current?.close();
          isDeleteSheetOpenRef.current = false;
          return true;
        }
        return false;
      },
    );

    return () => backHandler.remove();
  }, []);

  const handleDeletePress = React.useCallback(() => {
    isDeleteSheetOpenRef.current = true;
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
        isDeleteSheetOpenRef.current = false;
        navigation.goBack();
      } else {
        console.error(
          '[ProfileOverview] Failed to delete companion:',
          resultAction.payload,
        );
        showErrorAlert(
          'Delete Failed',
          'Failed to delete companion profile. Please try again.',
        );
      }
    } catch (error) {
      console.error('[ProfileOverview] Error deleting companion:', error);
      showErrorAlert(
        'Delete Failed',
        'An error occurred while deleting the companion profile.',
      );
    }
  }, [companion?.id, dispatch, navigation, parentId, showErrorAlert]);

  const handleDeleteCancel = React.useCallback(() => {
    isDeleteSheetOpenRef.current = false;
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
            rightIconTint={theme.colors.dangerText}
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

            {/* Two-column grid of tinted icon tiles (Companion profile hub) */}
            <View style={styles.grid}>
              {sections.map(item => {
                const visual = SECTION_VISUALS[item.id];
                const isCoParent = item.id === 'co_parent';
                return (
                  <PressableOpacity
                    key={item.id}
                    style={[styles.tile, isCoParent && styles.tileWide]}
                    activeOpacity={0.7}
                    onPress={() => handleSectionPress(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}>
                    <IconTile
                      size={38}
                      style={styles.tileIcon}
                      backgroundColor={theme.colors[visual.bg]}
                      iconNode={
                        <Ionicons
                          name={visual.icon}
                          size={18}
                          color={theme.colors[visual.ink]}
                        />
                      }
                    />
                    <Text style={styles.tileLabel} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {isCoParent && (
                      <>
                        {coParentAvatars.length > 0 && (
                          <View style={styles.coParentAvatars}>
                            {coParentAvatars.map(avatar => (
                              <View
                                key={avatar.key}
                                style={[
                                  styles.coParentAvatar,
                                  avatar.index % 2 === 0
                                    ? styles.coParentAvatarViolet
                                    : styles.coParentAvatarGreen,
                                  avatar.index > 0 &&
                                    styles.coParentAvatarStack,
                                ]}>
                                <Text
                                  style={[
                                    styles.coParentInitials,
                                    avatar.index % 2 === 0
                                      ? styles.coParentInitialsViolet
                                      : styles.coParentInitialsGreen,
                                  ]}>
                                  {avatar.initials}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                        <Ionicons
                          name="chevron-forward"
                          size={15}
                          color={theme.colors.inkFaint}
                        />
                      </>
                    )}
                  </PressableOpacity>
                );
              })}
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    ...createScreenContainerStyles(theme),
    ...createCenteredStyle(theme),
    emptyStateText: {
      ...theme.typography.body,
      color: theme.colors.inkMuted,
    },
    content: {
      paddingHorizontal: theme.spacing['5'],
      paddingBottom: theme.spacing['10'],
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing['2.5'],
      marginTop: theme.spacing['1'],
    },
    tile: {
      flexBasis: '47%',
      flexGrow: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['2.5'],
      padding: theme.spacing['3.5'],
      backgroundColor: theme.colors.screen,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      borderRadius: theme.borderRadius.cardSmall,
    },
    tileWide: {
      flexBasis: '100%',
    },
    tileIcon: {
      borderRadius: theme.spacing['3'],
    },
    tileLabel: {
      ...theme.typography.labelSmall,
      color: theme.colors.inkBody,
      flex: 1,
    },
    coParentAvatars: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    coParentAvatar: {
      width: theme.spacing['7'],
      height: theme.spacing['7'],
      borderRadius: theme.borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.screen,
    },
    coParentAvatarStack: {
      marginLeft: -theme.spacing['2'],
    },
    coParentAvatarViolet: {
      backgroundColor: theme.colors.avatarVioletBg,
    },
    coParentAvatarGreen: {
      backgroundColor: theme.colors.avatarGreenBg,
    },
    coParentInitials: {
      ...theme.typography.captionBold,
      fontSize: 10.5,
    },
    coParentInitialsViolet: {
      color: theme.colors.avatarVioletInk,
    },
    coParentInitialsGreen: {
      color: theme.colors.avatarGreenInk,
    },
  });
