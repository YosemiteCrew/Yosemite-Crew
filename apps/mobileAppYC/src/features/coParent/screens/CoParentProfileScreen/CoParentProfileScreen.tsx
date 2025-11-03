import React, {useEffect} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Text,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch} from '@/app/store';
import {useTheme} from '@/hooks';
import {Alert} from 'react-native';
import {Header} from '@/shared/components/common/Header/Header';
import {Images} from '@/assets/images';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {selectAuthUser} from '@/features/auth/selectors';
import {addCoParent} from '../../index';
import type {CoParentStackParamList} from '@/navigation/types';
import type {CoParent} from '../../types';
import {MOCK_SEARCHABLE_CO_PARENTS} from '../../mockData';
import {useState} from 'react';
import AddCoParentBottomSheet from '../../components/AddCoParentBottomSheet/AddCoParentBottomSheet';
import CoParentInviteBottomSheet from '../../components/CoParentInviteBottomSheet/CoParentInviteBottomSheet';

type Props = NativeStackScreenProps<CoParentStackParamList, 'CoParentProfile'>;

export const CoParentProfileScreen: React.FC<Props> = ({route, navigation}) => {
  const {coParentId} = route.params;
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();

  const [coParent, setCoParent] = useState<CoParent | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingInvite, setSendingInvite] = useState(false);
  const authUser = useSelector(selectAuthUser);
  const addCoParentSheetRef = React.useRef<any>(null);
  const coParentInviteSheetRef = React.useRef<any>(null);

  useEffect(() => {
    // Mock: Find co-parent from searchable data
    const found = MOCK_SEARCHABLE_CO_PARENTS.find(cp => cp.id === coParentId);
    setCoParent(found || null);
    setLoading(false);
  }, [coParentId]);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleSendInvite = async () => {
    if (!coParent || !authUser?.id) {
      Alert.alert('Error', 'Unable to send invite');
      return;
    }

    setSendingInvite(true);
    try {
      await dispatch(
        addCoParent({
          userId: authUser.id,
          inviteRequest: {
            candidateName: `${coParent.firstName} ${coParent.lastName}`,
            email: coParent.email,
            phoneNumber: coParent.phoneNumber || '',
          },
        }),
      ).unwrap();

      // Show success bottom sheet
      addCoParentSheetRef.current?.open();
    } catch (error) {
      console.error('Failed to send invite:', error);
      Alert.alert('Error', 'Failed to send invite');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleAddCoParentClose = () => {
    addCoParentSheetRef.current?.close();
    setTimeout(() => {
      coParentInviteSheetRef.current?.open();
    }, 300);
  };

  const handleInviteAccept = () => {
    coParentInviteSheetRef.current?.close();
    // Navigate back twice to return to ProfileOverviewScreen
    navigation.goBack();
    navigation.goBack();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Profile" showBackButton onBack={handleBack} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!coParent) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Profile" showBackButton onBack={handleBack} />
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Co-Parent not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = `${coParent.firstName} ${coParent.lastName}`.trim();

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Profile" showBackButton onBack={handleBack} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* Background Image & Profile Section */}
        <View style={styles.profileSection}>
          <Image
            source={Images.bgCoParent}
            style={styles.backgroundImage}
          />
          <View style={styles.profileImageWrapper}>
            {coParent.profilePicture ? (
              <Image
                source={{uri: coParent.profilePicture}}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.profileImageInitials}>
                <Text style={styles.profileInitialsText}>
                  {coParent.firstName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Parent Details */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Parent details</Text>
          <LiquidGlassCard
            glassEffect="clear"
            interactive
            style={styles.card}
            fallbackStyle={styles.cardFallback}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Name:</Text>
              <Text style={styles.detailValue}>{displayName}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone number:</Text>
              <Text style={styles.detailValue}>{coParent.phoneNumber || 'N/A'}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email address:</Text>
              <Text style={styles.detailValue}>{coParent.email}</Text>
            </View>
          </LiquidGlassCard>
        </View>

        {/* Companion Details */}
        {coParent.companions.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Companion details</Text>
            <LiquidGlassCard
              glassEffect="clear"
              interactive
              style={styles.card}
              fallbackStyle={styles.cardFallback}>
              {coParent.companions.map((companion, index) => (
                <View key={companion.companionId}>
                  <View style={styles.companionRow}>
                    {companion.profileImage ? (
                      <Image
                        source={{uri: companion.profileImage}}
                        style={styles.companionAvatar}
                      />
                    ) : (
                      <View style={styles.companionAvatarInitials}>
                        <Text style={styles.avatarInitialsText}>
                          {companion.companionName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.companionInfo}>
                      <Text style={styles.companionName}>{companion.companionName}</Text>
                      <Text style={styles.companionBreed}>{companion.breed || 'Unknown'}</Text>
                    </View>
                  </View>
                  {index < coParent.companions.length - 1 && <View style={styles.detailDivider} />}
                </View>
              ))}
            </LiquidGlassCard>
          </View>
        )}

        {/* Send Invite Button */}
        <View style={styles.sendButtonContainer}>
          <LiquidGlassButton
            title={sendingInvite ? 'Sending...' : 'Send invite'}
            onPress={handleSendInvite}
            style={styles.button}
            textStyle={styles.buttonText}
            tintColor={theme.colors.secondary}
            shadowIntensity="medium"
            forceBorder
            borderColor={theme.colors.borderMuted}
            height={56}
            borderRadius={16}
            loading={sendingInvite}
            disabled={sendingInvite}
          />
        </View>
      </ScrollView>

      <AddCoParentBottomSheet
        ref={addCoParentSheetRef}
        coParentName={coParent.firstName}
        coParentEmail={coParent.email}
        coParentPhone={coParent.phoneNumber || ''}
        onConfirm={handleAddCoParentClose}
      />

      <CoParentInviteBottomSheet
        ref={coParentInviteSheetRef}
        coParentName={coParent.firstName}
        coParentProfileImage={coParent.profilePicture}
        companionName={coParent.companions[0]?.companionName || 'Companion'}
        companionProfileImage={coParent.companions[0]?.profileImage}
        onAccept={handleInviteAccept}
        onDecline={() => {
          coParentInviteSheetRef.current?.close();
          // Navigate back twice to return to ProfileOverviewScreen
          navigation.goBack();
          navigation.goBack();
        }}
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
      paddingBottom: theme.spacing[10],
    },
    profileSection: {
      position: 'relative',
      alignItems: 'center',
      paddingBottom: theme.spacing[6],
      marginBottom: theme.spacing[4],
    },
    backgroundImage: {
      width: '100%',
      height: 200,
      resizeMode: 'cover',
    },
    profileImageWrapper: {
      position: 'absolute',
      bottom: -20,
      width: 120,
      height: 120,
    },
    profileImage: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 4,
      borderColor: theme.colors.white,
    },
    profileImageInitials: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 4,
      borderColor: theme.colors.white,
      backgroundColor: theme.colors.lightBlueBackground,
      justifyContent: 'center',
      alignItems: 'center',
    },
    profileInitialsText: {
      ...theme.typography.h1,
      color: theme.colors.secondary,
    },
    sectionContainer: {
      paddingHorizontal: theme.spacing[5],
      marginBottom: theme.spacing[5],
    },
    sectionTitle: {
      ...theme.typography.h5,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[3],
    },
    card: {
      paddingVertical: theme.spacing[3],
      paddingHorizontal: theme.spacing[4],
      gap: theme.spacing[2],
    },
    cardFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.white,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing[2],
    },
    detailLabel: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      flex: 1,
    },
    detailValue: {
      ...theme.typography.body,
      color: theme.colors.secondary,
      flex: 1,
      textAlign: 'right',
    },
    detailDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing[2],
    },
    companionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing[2],
      gap: theme.spacing[3],
    },
    companionAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    companionAvatarInitials: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.lightBlueBackground,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarInitialsText: {
      ...theme.typography.h5,
      color: theme.colors.secondary,
    },
    companionInfo: {
      flex: 1,
    },
    companionName: {
      ...theme.typography.h4,
      color: theme.colors.secondary,
    },
    companionBreed: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    sendButtonContainer: {
      paddingHorizontal: theme.spacing[5],
      marginTop: theme.spacing[4],
      marginBottom: theme.spacing[4],
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
      ...theme.typography.paragraphBold,
    },
    centerContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
  });

export default CoParentProfileScreen;
