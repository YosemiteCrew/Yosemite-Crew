import React, {useEffect, useState} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Text,
  Switch,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch} from '@/app/store';
import {useTheme} from '@/hooks';
import {Alert, Image as RNImage} from 'react-native';
import {Header} from '@/shared/components/common/Header/Header';
import {Images} from '@/assets/images';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {
  selectCoParentById,
  updateCoParentPermissions,
  selectCoParentLoading,
  deleteCoParent,
} from '../../index';
import {selectCompanions, selectSelectedCompanionId} from '@/features/companion';
import type {CoParentStackParamList} from '@/navigation/types';
import type {CoParent, CoParentPermissions} from '../../types';
import DeleteCoParentBottomSheet from '../../components/DeleteCoParentBottomSheet/DeleteCoParentBottomSheet';
import {MOCK_CO_PARENTS} from '../../mockData';

type Props = NativeStackScreenProps<CoParentStackParamList, 'EditCoParent'>;

export const EditCoParentScreen: React.FC<Props> = ({route, navigation}) => {
  const {coParentId} = route.params;
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();

  const coParent = useSelector(state => selectCoParentById(coParentId)(state as any));
  const loading = useSelector(selectCoParentLoading);
  const companions = useSelector(selectCompanions);
  const globalSelectedCompanionId = useSelector(selectSelectedCompanionId);

  const [mockCoParent, setMockCoParent] = useState<CoParent | null>(null);
  const [permissions, setPermissions] = useState<CoParentPermissions | null>(null);
  const [selectedCompanionId, setSelectedCompanionId] = useState<string | null>(globalSelectedCompanionId);
  const [permissionsByCompanion, setPermissionsByCompanion] = useState<Record<string, CoParentPermissions>>({});
  const deleteSheetRef = React.useRef<any>(null);
  const [isDeleteSheetOpen, setIsDeleteSheetOpen] = useState(false);

  useEffect(() => {
    // Mock: Find from mock data if not in Redux
    if (!coParent) {
      const found = MOCK_CO_PARENTS.find(cp => cp.id === coParentId);
      if (found) {
        setMockCoParent(found);
        setPermissions(found.permissions);
      }
    } else {
      setPermissions(coParent.permissions);
    }
  }, [coParent, coParentId]);

  // Update current permissions when selected companion changes
  useEffect(() => {
    if (selectedCompanionId && permissionsByCompanion[selectedCompanionId]) {
      setPermissions(permissionsByCompanion[selectedCompanionId]);
    } else if (permissions && selectedCompanionId) {
      // Initialize permissions for newly selected companion
      setPermissionsByCompanion(prev => ({
        ...prev,
        [selectedCompanionId]: permissions,
      }));
    }
  }, [selectedCompanionId]);

  const currentCoParent = coParent || mockCoParent;

  if (!currentCoParent || !permissions) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Co-Parent Permissions" showBackButton onBack={() => navigation.goBack()} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const handlePermissionChange = (key: keyof CoParentPermissions) => {
    if (!permissions || !selectedCompanionId) return;

    const updated = {
      ...permissions,
      [key]: !permissions[key],
    };
    setPermissions(updated);

    // Store in per-companion map
    setPermissionsByCompanion(prev => ({
      ...prev,
      [selectedCompanionId]: updated,
    }));
  };

  const handleCompanionSelect = (companionId: string | null) => {
    setSelectedCompanionId(companionId);
  };

  const handleSavePermissions = async () => {
    try {
      if (!selectedCompanionId && Object.keys(permissionsByCompanion).length === 0) {
        Alert.alert('Error', 'Please select a companion and configure permissions');
        return;
      }

      // Save permissions for the currently selected companion
      const permissionsToSave = selectedCompanionId && permissionsByCompanion[selectedCompanionId]
        ? permissionsByCompanion[selectedCompanionId]
        : permissions;

      await dispatch(updateCoParentPermissions({coParentId, permissions: permissionsToSave})).unwrap();
      navigation.goBack();
    } catch (error) {
      console.error('Failed to update permissions:', error);
      Alert.alert('Error', 'Failed to save permissions');
    }
  };

  const handleDeletePress = () => {
    setIsDeleteSheetOpen(true);
    deleteSheetRef.current?.open();
  };

  const handleDeleteConfirm = async () => {
    try {
      await dispatch(deleteCoParent(coParentId)).unwrap();
      setIsDeleteSheetOpen(false);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to delete:', error);
      Alert.alert('Error', 'Failed to delete co-parent');
    }
  };

  const displayName = `${currentCoParent.firstName} ${currentCoParent.lastName}`.trim();

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Co-Parent permissions"
        showBackButton
        onBack={() => navigation.goBack()}
        rightIcon={Images.deleteIconRed}
        onRightPress={handleDeletePress}
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
                  {currentCoParent.firstName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{displayName}</Text>
              <View style={styles.contactRow}>
                <RNImage source={Images.emailIcon} style={styles.contactIcon} />
                <Text style={styles.profileEmail}>{currentCoParent.email}</Text>
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
        {companions.length > 0 && (
          <CompanionSelector
            companions={companions}
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
              />
            </View>
          </LiquidGlassCard>
        </View>

        {/* Save Button */}
        <View style={styles.saveButton}>
          <LiquidGlassButton
            title={loading ? 'Saving...' : 'Save Permissions'}
            onPress={handleSavePermissions}
            style={styles.button}
            textStyle={styles.buttonText}
            tintColor={theme.colors.secondary}
            shadowIntensity="medium"
            forceBorder
            borderColor={theme.colors.borderMuted}
            height={56}
            borderRadius={16}
            loading={loading}
            disabled={loading}
          />
        </View>
      </ScrollView>

      <DeleteCoParentBottomSheet
        ref={deleteSheetRef}
        coParentName={displayName}
        onDelete={handleDeleteConfirm}
        onCancel={() => setIsDeleteSheetOpen(false)}
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
    button: {
      width: '100%',
      backgroundColor: theme.colors.secondary,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 8},
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 4,
    },
    buttonText: {
      color: theme.colors.white,
      ...theme.typography.titleMedium,
    },
    centerContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

export default EditCoParentScreen;
