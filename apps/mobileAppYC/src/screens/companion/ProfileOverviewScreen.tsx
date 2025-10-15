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
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '@/hooks';
import {Header} from '@/components';
import {Images} from '@/assets/images';
import {HomeStackParamList} from '@/navigation/types';
import {LiquidGlassCard} from '@/components/common/LiquidGlassCard/LiquidGlassCard';
import DeleteProfileBottomSheet, {
  type DeleteProfileBottomSheetRef,
} from '../../components/common/DeleteProfileBottomSheet/DeleteProfileBottomSheet';

import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch} from '@/app/store';
import {
  selectCompanions,
  selectCompanionLoading,
} from '@/features/companion/selectors';
import {deleteCompanion} from '@/features/companion/thunks';
import {useAuth} from '@/contexts/AuthContext';

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

  const dispatch = useDispatch<AppDispatch>();
  const {user} = useAuth();

  const allCompanions = useSelector(selectCompanions);
  const isLoading = useSelector(selectCompanionLoading);

  const companion = React.useMemo(
    () => allCompanions.find(c => c.id === companionId),
    [allCompanions, companionId],
  );

    // NEW: Handler for navigating to the Edit Screen
  const handleSectionPress = (sectionId: string) => {
    if (sectionId === 'overview') {
      navigation.navigate('EditCompanionOverview', {companionId});
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

    const resultAction = await dispatch(
      deleteCompanion({userId: user.id, companionId: companion.id}),
    );

    if (deleteCompanion.fulfilled.match(resultAction)) {
      navigation.goBack();
    } else {
      console.error('Failed to delete companion:', resultAction.payload);
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
            <Text style={styles.profileName}>Companion not found.</Text>
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
        {/* Top section — normal */}
        <View style={styles.profileHeader}>
          <View>
            <Image
              source={
                companion.profileImage
                  ? {uri: companion.profileImage}
                  : Images.cat
              }
              style={styles.avatar}
            />
            <TouchableOpacity style={styles.cameraIconContainer}>
              <Image source={Images.cameraIcon} style={styles.cameraIcon} />
            </TouchableOpacity>
          </View>
          <Text style={styles.profileName}>{companion.name}</Text>
          <Text style={styles.profileBreed}>
            {companion.breed?.breedName ?? 'Unknown Breed'}
          </Text>
        </View>

        {/* Only menu list inside glass card */}
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
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      paddingHorizontal: theme.spacing[5],
      paddingBottom: theme.spacing[10],
    },
    profileHeader: {
      alignItems: 'center',
      marginVertical: theme.spacing[6],
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.colors.border,
    },
    cameraIconContainer: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: theme.colors.secondary,
      padding: theme.spacing[2],
      borderRadius: theme.borderRadius.full,
      borderWidth: 2,
      borderColor: theme.colors.background,
    },
    cameraIcon: {
      width: 16,
      height: 16,
      tintColor: theme.colors.white,
    },
    profileName: {
      ...theme.typography.h4Alt,
      color: theme.colors.secondary,
      marginTop: theme.spacing[4],
    },
    profileBreed: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing[1],
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
