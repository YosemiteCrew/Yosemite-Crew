import React, {useEffect, useState, useMemo} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Text,
  Switch,
  ActivityIndicator,
  Alert,
  Image as RNImage,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NavigationProp} from '@react-navigation/native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch, RootState} from '@/app/store';
import {useTheme} from '@/hooks';
import {Header} from '@/shared/components/common/Header/Header';
import {Images} from '@/assets/images';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {
  updateCoParentPermissions,
  selectCoParentLoading,
  deleteCoParent,
  fetchCoParents,
  promoteCoParentToPrimary,
  fetchParentAccess,
} from '../../index';
import {
  selectCompanions,
  selectSelectedCompanionId,
  setSelectedCompanion,
  fetchCompanions,
} from '@/features/companion';
import {selectAuthUser} from '@/features/auth/selectors';
import type {CoParentStackParamList, HomeStackParamList} from '@/navigation/types';
import type {CoParent, CoParentPermissions} from '../../types';
import DeleteCoParentBottomSheet, {type DeleteCoParentBottomSheetRef} from '../../components/DeleteCoParentBottomSheet/DeleteCoParentBottomSheet';
import {createCommonCoParentStyles} from '../../styles/commonStyles';

type Props = NativeStackScreenProps<CoParentStackParamList, 'EditCoParent'>;

export const EditCoParentScreen: React.FC<Props> = ({route, navigation}) => {
  const {coParentId} = route.params;
  const {theme} = useTheme();
  const commonStyles = useMemo(() => createCommonCoParentStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();

  const coParent = useSelector((state: any) => {
    const list: CoParent[] = state?.coParent?.coParents ?? [];
    return list.find(cp => cp.id === coParentId || cp.parentId === coParentId) ?? null;
  });
  const loading = useSelector(selectCoParentLoading);
  const authUser = useSelector(selectAuthUser);
  const companions = useSelector(selectCompanions);
  const globalSelectedCompanionId = useSelector(selectSelectedCompanionId);
  const accessMap = useSelector(
    (state: RootState) => state.coParent?.accessByCompanionId ?? {},
  );
  const defaultAccess = useSelector((state: RootState) => state.coParent?.defaultAccess ?? null);
  const globalRole = useSelector((state: RootState) => state.coParent?.lastFetchedRole);

  const [selectedCompanionId, setSelectedCompanionId] = useState<string | null>(
    globalSelectedCompanionId ?? coParent?.companionId ?? null,
  );
  const defaultPermissions: CoParentPermissions = {
    assignAsPrimaryParent: false,
    emergencyBasedPermissions: false,
    appointments: false,
    companionProfile: false,
    documents: false,
    expenses: false,
    tasks: false,
    chatWithVet: false,
  };
  const [permissions, setPermissions] = useState<CoParentPermissions>(defaultPermissions);
  const deleteSheetRef = React.useRef<DeleteCoParentBottomSheetRef>(null);
  const [isPromoting, setIsPromoting] = useState(false);

  const selectedCompanion = useMemo(
    () =>
      companions.find(c => c.id === selectedCompanionId) ??
      companions.find(c => c.id === globalSelectedCompanionId) ??
      companions[0] ??
      null,
    [companions, globalSelectedCompanionId, selectedCompanionId],
  );
  const companionsToShow = useMemo(
    () => (selectedCompanion ? [selectedCompanion] : companions),
    [companions, selectedCompanion],
  );
  const companionAccessId = selectedCompanion?.id ?? selectedCompanionId ?? null;
  const userAccessEntry =
    companionAccessId && accessMap
      ? accessMap[companionAccessId] ?? defaultAccess ?? null
      : defaultAccess;
  const userRole = (userAccessEntry?.role ?? defaultAccess?.role ?? globalRole ?? '').toUpperCase();
  const canEditPermissions = userRole.includes('PRIMARY');

  useEffect(() => {
    if (!selectedCompanionId && coParent?.companionId) {
      setSelectedCompanionId(coParent.companionId);
      dispatch(setSelectedCompanion(coParent.companionId));
    }
  }, [coParent?.companionId, dispatch, selectedCompanionId]);

  useEffect(() => {
    if (coParent?.permissions) {
      setPermissions(coParent.permissions);
    }
  }, [coParent]);

  useEffect(() => {
    if (!selectedCompanionId && selectedCompanion?.id) {
      setSelectedCompanionId(selectedCompanion.id);
    }
  }, [selectedCompanion, selectedCompanionId]);

  useEffect(() => {
    if (!coParent && selectedCompanion?.id) {
      dispatch(
        fetchCoParents({
          companionId: selectedCompanion.id,
          companionName: selectedCompanion.name,
          companionImage: selectedCompanion.profileImage ?? undefined,
        }),
      );
    }
  }, [coParent, dispatch, selectedCompanion]);

  const currentCoParent = coParent;

  useEffect(() => {
    const isSelfPrimary =
      (currentCoParent?.role ?? '').toUpperCase().includes('PRIMARY') &&
      currentCoParent?.parentId === authUser?.parentId;
    if (isSelfPrimary) {
      Alert.alert('Not available', 'Primary parents cannot edit their own permissions.');
      navigation.goBack();
    }
  }, [authUser?.parentId, currentCoParent?.parentId, currentCoParent?.role, navigation]);

  if (!currentCoParent || !permissions) {
    if (!loading) {
      return (
        <SafeAreaView style={commonStyles.container}>
          <Header title="Co-Parent Permissions" showBackButton onBack={() => navigation.goBack()} />
          <View style={commonStyles.centerContent}>
            <Text style={styles.profileEmail}>Unable to load co-parent details.</Text>
          </View>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={commonStyles.container}>
        <Header title="Co-Parent Permissions" showBackButton onBack={() => navigation.goBack()} />
        <View style={commonStyles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const performOwnershipTransfer = async () => {
    if (isPromoting) {
      return;
    }
    if (!canEditPermissions) {
      Alert.alert('Not allowed', 'Only the primary parent can transfer ownership.');
      return;
    }
    if (!selectedCompanionId || !currentCoParent) {
      Alert.alert('Select companion', 'Please select a companion first.');
      return;
    }
    const targetCoParentId = currentCoParent.parentId || currentCoParent.id || coParentId;
    if (!targetCoParentId) {
      Alert.alert('Error', 'Unable to determine co-parent details. Please try again.');
      return;
    }

    try {
      setIsPromoting(true);
      await dispatch(
        promoteCoParentToPrimary({
          companionId: selectedCompanionId,
          coParentId: targetCoParentId,
        }),
      ).unwrap();

      if (authUser?.parentId) {
        try {
          await dispatch(fetchCompanions(authUser.parentId)).unwrap();
        } catch (err) {
          console.warn('Failed to refresh companions after promotion', err);
        }
        const companionIds = companions
          .map(c => c.id)
          .filter((id): id is string => Boolean(id));
        try {
          await dispatch(
            fetchParentAccess({
              parentId: authUser.parentId,
              companionIds: companionIds.length > 0 ? companionIds : undefined,
            }),
          ).unwrap();
        } catch (err) {
          console.warn('Failed to refresh access after promotion', err);
        }
      }

      const homeStackNavigation =
        navigation.getParent<NavigationProp<HomeStackParamList>>();
      if (homeStackNavigation) {
        homeStackNavigation.reset({
          index: 0,
          routes: [{name: 'Home'}],
        });
      } else {
        navigation.reset({
          index: 0,
          routes: [{name: 'CoParents'}],
        });
      }
    } catch (error) {
      console.error('Failed to promote co-parent:', error);
      Alert.alert('Error', 'Failed to transfer ownership. Please try again.');
    } finally {
      setIsPromoting(false);
    }
  };

  const requestOwnershipTransfer = () => {
    if (!canEditPermissions) {
      Alert.alert('Not allowed', 'Only the primary parent can transfer ownership.');
      return;
    }
    if (!selectedCompanionId) {
      Alert.alert('Select companion', 'Please select a companion first.');
      return;
    }
    Alert.alert(
      'Transfer primary parent role?',
      'This will make this co-parent the new primary parent for the selected companion. You will lose owner permissions immediately.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Transfer',
          style: 'destructive',
          onPress: () => {
            performOwnershipTransfer();
          },
        },
      ],
    );
  };

  const handlePermissionChange = (key: keyof CoParentPermissions) => {
    if (key === 'assignAsPrimaryParent') {
      requestOwnershipTransfer();
      return;
    }
    if (!canEditPermissions) {
      return;
    }
    if (!selectedCompanionId) {
      Alert.alert('Select companion', 'Please select a companion first.');
      return;
    }
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleCompanionSelect = (companionId: string | null) => {
    setSelectedCompanionId(companionId);
  };

  const handleSavePermissions = async () => {
    if (!canEditPermissions) {
      Alert.alert('Not allowed', 'Only the primary parent can update permissions.');
      return;
    }
    try {
      if (!selectedCompanionId || !currentCoParent) {
        Alert.alert('Error', 'Please select a companion and try again');
        return;
      }

      const targetCoParentId = currentCoParent.parentId || currentCoParent.id || coParentId;
      await dispatch(
        updateCoParentPermissions({
          coParentId: targetCoParentId,
          companionId: selectedCompanionId,
          permissions,
        }),
      ).unwrap();
      navigation.goBack();
    } catch (error) {
      console.error('Failed to update permissions:', error);
      Alert.alert('Error', 'Failed to save permissions');
    }
  };

  const handleDeletePress = () => {
    deleteSheetRef.current?.open();
  };

  const handleDeleteConfirm = async () => {
    try {
      if (!selectedCompanionId) {
        Alert.alert('Error', 'Please select a companion and try again');
        return;
      }
      const targetCoParentId = currentCoParent?.parentId || currentCoParent?.id || coParentId;
      await dispatch(
        deleteCoParent({companionId: selectedCompanionId, coParentId: targetCoParentId}),
      ).unwrap();
      navigation.goBack();
    } catch (error) {
      console.error('Failed to delete:', error);
      Alert.alert('Error', 'Failed to delete co-parent');
    }
  };

  const displayName =
    `${currentCoParent.firstName ?? ''} ${currentCoParent.lastName ?? ''}`.trim() || 'Co-parent';

  const disableControls = !canEditPermissions || isPromoting;

  return (
    <SafeAreaView style={commonStyles.container}>
      <Header
        title="Co-Parent permissions"
        showBackButton
        onBack={() => navigation.goBack()}
        rightIcon={canEditPermissions ? Images.deleteIconRed : undefined}
        onRightPress={canEditPermissions ? handleDeletePress : undefined}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* Co-Parent Profile Card */}
        <LiquidGlassCard
          glassEffect="clear"
          interactive
          style={styles.profileCard}
          fallbackStyle={styles.cardFallback}>
          <View style={styles.profileRow}>
            {currentCoParent.profilePicture ? (
              <Image
                source={{uri: currentCoParent.profilePicture}}
                style={styles.profileAvatar}
              />
            ) : (
              <View style={styles.profileAvatarInitials}>
                <Text style={styles.profileAvatarText}>
                  {(currentCoParent.firstName ||
                    currentCoParent.lastName ||
                    currentCoParent.email ||
                    'C')
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{displayName}</Text>
              <View style={styles.contactRow}>
                <RNImage source={Images.emailIcon} style={styles.contactIcon} />
                <Text style={styles.profileEmail}>
                  {currentCoParent.email || 'Email not available yet'}
                </Text>
              </View>
              {currentCoParent.phoneNumber && (
                <View style={styles.contactRow}>
                  <RNImage source={Images.phone} style={styles.contactIcon} />
                  <Text style={styles.profilePhone}>{currentCoParent.phoneNumber}</Text>
                </View>
              )}
            </View>
          </View>
        </LiquidGlassCard>
        
  {/* First Note - About turning on permissions */}
        <View style={styles.noteContainer}>
          <Text style={styles.noteText}>
            <Text style={styles.noteLabel}>Note: </Text>
            <Text style={styles.noteMessage}>
              By turning these on, you're giving this co-parent permission to view and edit the selected areas for your companion
            </Text>
          </Text>
        </View>

        {/* Select Companion Heading */}
        <View style={styles.selectCompanionHeader}>
          <Text style={styles.selectCompanionTitle}>Select companion</Text>
        </View>

      

        {/* Companion Selector */}
        {companionsToShow.length > 0 && (
          <CompanionSelector
            companions={companionsToShow}
            selectedCompanionId={selectedCompanionId}
            onSelect={handleCompanionSelect}
            showAddButton={false}
          />
        )}

        {/* Second Note - About primary parent */}
        <View style={styles.noteContainer}>
          <Text style={styles.noteText}>
            <Text style={styles.noteLabel}>Note: </Text>
            <Text style={styles.noteMessage}>
              Selecting this option changes the primary parent, giving them ownership of your companion's documents. If you delete the app, your companion's documents stay intact unless the new primary parent deletes the app.
            </Text>
          </Text>
        </View>

        {/* Permissions Section - No heading, just permissions */}
        <View style={styles.sectionContainer}>

        <LiquidGlassCard
          glassEffect="clear"
          interactive
          style={styles.card}
          fallbackStyle={styles.cardFallback}>
            {/* Assign as primary parent */}
            <View style={styles.permissionRow}>
              <Text style={styles.permissionLabel}>Assign as primary parent</Text>
              <Switch
                value={permissions.assignAsPrimaryParent}
                onValueChange={() => handlePermissionChange('assignAsPrimaryParent')}
                trackColor={{false: theme.colors.border, true: theme.colors.primary}}
                thumbColor={theme.colors.white}
                disabled={disableControls}
              />
            </View>
            <View style={styles.divider} />

            {/* Emergency based permissions */}
            <View style={styles.permissionRow}>
              <Text style={styles.permissionLabel}>Emergency based Permissions</Text>
              <Switch
                value={permissions.emergencyBasedPermissions}
                onValueChange={() => handlePermissionChange('emergencyBasedPermissions')}
                trackColor={{false: theme.colors.border, true: theme.colors.primary}}
                thumbColor={theme.colors.white}
                disabled={disableControls}
              />
            </View>
            <View style={styles.divider} />

            {/* Appointments */}
            <View style={styles.permissionRow}>
              <Text style={styles.permissionLabel}>Appointments</Text>
              <Switch
                value={permissions.appointments}
                onValueChange={() => handlePermissionChange('appointments')}
                trackColor={{false: theme.colors.border, true: theme.colors.primary}}
                thumbColor={theme.colors.white}
                disabled={disableControls}
              />
            </View>
            <View style={styles.divider} />

            {/* Companion Profile */}
            <View style={styles.permissionRow}>
              <Text style={styles.permissionLabel}>Companion Profile</Text>
              <Switch
                value={permissions.companionProfile}
                onValueChange={() => handlePermissionChange('companionProfile')}
                trackColor={{false: theme.colors.border, true: theme.colors.primary}}
                thumbColor={theme.colors.white}
                disabled={disableControls}
              />
            </View>
            <View style={styles.divider} />

            {/* Documents */}
            <View style={styles.permissionRow}>
              <Text style={styles.permissionLabel}>Documents</Text>
              <Switch
                value={permissions.documents}
                onValueChange={() => handlePermissionChange('documents')}
                trackColor={{false: theme.colors.border, true: theme.colors.primary}}
                thumbColor={theme.colors.white}
                disabled={disableControls}
              />
            </View>
            <View style={styles.divider} />

            {/* Expenses */}
            <View style={styles.permissionRow}>
              <Text style={styles.permissionLabel}>Expenses</Text>
              <Switch
                value={permissions.expenses}
                onValueChange={() => handlePermissionChange('expenses')}
                trackColor={{false: theme.colors.border, true: theme.colors.primary}}
                thumbColor={theme.colors.white}
                disabled={disableControls}
              />
            </View>
            <View style={styles.divider} />

            {/* Tasks */}
            <View style={styles.permissionRow}>
              <Text style={styles.permissionLabel}>Tasks</Text>
              <Switch
                value={permissions.tasks}
                onValueChange={() => handlePermissionChange('tasks')}
                trackColor={{false: theme.colors.border, true: theme.colors.primary}}
                thumbColor={theme.colors.white}
                disabled={disableControls}
              />
            </View>
            <View style={styles.divider} />

            {/* Chat with Vet */}
            <View style={styles.permissionRow}>
              <Text style={styles.permissionLabel}>Chat with Vet</Text>
              <Switch
                value={permissions.chatWithVet}
                onValueChange={() => handlePermissionChange('chatWithVet')}
                trackColor={{false: theme.colors.border, true: theme.colors.primary}}
                thumbColor={theme.colors.white}
                disabled={disableControls}
              />
            </View>
          </LiquidGlassCard>
        </View>

        {!canEditPermissions && (
          <Text style={styles.readOnlyNote}>
            You can view these permissions, but only the primary parent can make changes.
          </Text>
        )}

        {canEditPermissions && (
          <View style={styles.saveButton}>
            <LiquidGlassButton
              title={
                loading ? 'Saving...' : isPromoting ? 'Transferring...' : 'Save Permissions'
              }
              onPress={handleSavePermissions}
              style={commonStyles.button}
              textStyle={commonStyles.buttonText}
              tintColor={theme.colors.secondary}
              shadowIntensity="medium"
              forceBorder
              borderColor={theme.colors.borderMuted}
              height={56}
              borderRadius={16}
              loading={loading || isPromoting}
              disabled={loading || isPromoting}
            />
          </View>
        )}
      </ScrollView>

      <DeleteCoParentBottomSheet
        ref={deleteSheetRef}
        coParentName={displayName}
        onDelete={handleDeleteConfirm}
        onCancel={() => deleteSheetRef.current?.close()}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: theme.spacing[4],
      paddingBottom: theme.spacing[24],
    },
    profileCard: {
      paddingVertical: theme.spacing[3],
      paddingHorizontal: theme.spacing[4],
      marginTop: theme.spacing[4],
    },
    card: {
      paddingVertical: theme.spacing[2],
      paddingHorizontal: theme.spacing[4],
    },
    cardFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.white,
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing[3],
    },
    profileAvatar: {
      width: 70,
      height: 70,
      borderRadius: 40,
    },
    profileAvatarInitials: {
      width: 70,
      height: 70,
      borderRadius: 40,
      backgroundColor: theme.colors.lightBlueBackground,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    profileAvatarText: {
      ...theme.typography.h4,
      color: theme.colors.secondary,
    },
    profileInfo: {
      flex: 1,
    },
    profileName: {
      ...theme.typography.titleLarge,
      color: theme.colors.text,
      marginBottom: theme.spacing[2],
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
      marginBottom: theme.spacing[1],
    },
    contactIcon: {
      width: 16,
      height: 16,
      tintColor: theme.colors.text,
    },
    profileEmail: {
      ...theme.typography.inputLabel,
      color: theme.colors.text,
    },
    profilePhone: {
      ...theme.typography.inputLabel,
      color: theme.colors.text,
    },
    selectCompanionHeader: {
      marginTop: theme.spacing[4],
      marginBottom: theme.spacing[3],
    },
    selectCompanionTitle: {
      ...theme.typography.titleLarge,
      color: theme.colors.secondary,
            paddingHorizontal: theme.spacing[4],
    },
    noteContainer: {
      marginTop: theme.spacing[6],
           paddingHorizontal: theme.spacing[4],
    },
    noteText: {
      ...theme.typography.labelXsBold,
      textAlign: 'justify',
    },
    noteLabel: {
      color: theme.colors.primary,
    },
    noteMessage: {
      color: theme.colors.placeholder,
    },
    sectionContainer: {
      gap: theme.spacing[4],
      paddingBlock: theme.spacing[6],
    },
    sectionTitle: {
      ...theme.typography.h5,
      color: theme.colors.secondary,
    },
    permissionsHeader: {
      gap: theme.spacing[2],

    },
    permissionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing[3],
    },
    permissionLabel: {
      ...theme.typography.inputLabel,
      color: theme.colors.secondary,
      flex: 1,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
    },
    saveButton: {
      marginTop: theme.spacing[4],
    },
    readOnlyNote: {
      ...theme.typography.bodySmall,
      color: theme.colors.placeholder,
      textAlign: 'center',
      paddingHorizontal: theme.spacing[4],
      marginTop: theme.spacing[4],
    },
  });

export default EditCoParentScreen;
