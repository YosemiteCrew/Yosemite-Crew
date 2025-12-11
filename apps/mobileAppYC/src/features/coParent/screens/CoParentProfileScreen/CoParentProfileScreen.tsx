import React, {useEffect, useState, useMemo} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Text,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch} from '@/app/store';
import {useTheme} from '@/hooks';
import {Header} from '@/shared/components/common/Header/Header';
import {GifLoader} from '@/shared/components/common';
import {Images} from '@/assets/images';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {normalizeImageUri} from '@/shared/utils/imageUri';
import {addCoParent, selectCoParentById} from '../../index';
import type {CoParentStackParamList} from '@/navigation/types';
import type {CoParent} from '../../types';
import AddCoParentBottomSheet from '../../components/AddCoParentBottomSheet/AddCoParentBottomSheet';
import CoParentInviteBottomSheet from '../../components/CoParentInviteBottomSheet/CoParentInviteBottomSheet';
import {useCoParentInviteFlow} from '../../hooks/useCoParentInviteFlow';
import {createCommonCoParentStyles} from '../../styles/commonStyles';
import {selectCompanions} from '@/features/companion';

type Props = NativeStackScreenProps<CoParentStackParamList, 'CoParentProfile'>;

export const CoParentProfileScreen: React.FC<Props> = ({route, navigation}) => {
  const {coParentId} = route.params;
  const {theme} = useTheme();
  const commonStyles = useMemo(() => createCommonCoParentStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();

  const coParentFromStore = useSelector(state =>
    selectCoParentById(coParentId)(state as any),
  );
  const [coParent, setCoParent] = useState<CoParent | null>(coParentFromStore ?? null);
  const [loading, setLoading] = useState(true);
  const [sendingInvite, setSendingInvite] = useState(false);
  const companions = useSelector(selectCompanions);

  const {
    addCoParentSheetRef,
    coParentInviteSheetRef,
    handleAddCoParentClose,
    handleInviteAccept,
    handleInviteDecline,
  } = useCoParentInviteFlow({
    onInviteComplete: () => {
      navigation.goBack();
      navigation.goBack();
    },
  });

  useEffect(() => {
    setCoParent(coParentFromStore ?? null);
    setLoading(false);
  }, [coParentFromStore]);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleSendInvite = async () => {
    const companionId =
      companions[0]?.id ??
      (companions[0] as any)?._id ??
      (companions[0] as any)?.companionId ??
      null;
    if (!coParent || !companionId) {
      Alert.alert('Error', 'Unable to send invite. Please select a companion.');
      return;
    }

    const inviteEmail = coParent.email?.trim();
    if (!inviteEmail) {
      Alert.alert('Missing email', 'This co-parent does not have an email address on file.');
      return;
    }
    const inviteName = `${coParent.firstName ?? ''} ${coParent.lastName ?? ''}`.trim();
    setSendingInvite(true);
    try {
      await dispatch(
        addCoParent({
          inviteRequest: {
            candidateName: inviteName.length > 0 ? inviteName : inviteEmail,
            email: inviteEmail,
            phoneNumber: coParent.phoneNumber || '',
            companionId,
          },
          companionName: companions[0]?.name,
          companionImage: companions[0]?.profileImage ?? undefined,
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

  if (loading) {
    return (
      <SafeAreaView style={commonStyles.container}>
        <Header title="Profile" showBackButton onBack={handleBack} />
        <View style={commonStyles.centerContent}>
          <GifLoader />
        </View>
      </SafeAreaView>
    );
  }

  if (!coParent) {
    return (
      <SafeAreaView style={commonStyles.container}>
        <Header title="Profile" showBackButton onBack={handleBack} />
        <View style={commonStyles.centerContent}>
          <Text style={styles.errorText}>Co-Parent not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = `${coParent.firstName} ${coParent.lastName}`.trim();

  return (
    <SafeAreaView style={commonStyles.container}>
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
                  {(coParent.firstName ||
                    coParent.lastName ||
                    coParent.email ||
                    'C')
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
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
              <Text style={styles.detailValue}>{coParent.email ?? 'N/A'}</Text>
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
                        source={{uri: normalizeImageUri(companion.profileImage) ?? ''}}
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
            style={commonStyles.button}
            textStyle={commonStyles.buttonText}
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
        companionName={companions[0]?.name || 'Companion'}
        companionProfileImage={companions[0]?.profileImage || undefined}
        onAccept={handleInviteAccept}
        onDecline={handleInviteDecline}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
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
      ...theme.typography.paragraphBold,
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
      ...theme.typography.pillSubtitleBold15,
      color: theme.colors.textSecondary,
      flex: 1,
    },
    detailValue: {
      ...theme.typography.pillSubtitleBold15,
      color: theme.colors.placeholder,
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
      ...theme.typography.h4Alt,
      color: theme.colors.secondary,
    },
    companionBreed: {
      ...theme.typography.subtitleRegular14,
      color: theme.colors.textSecondary,
    },
    sendButtonContainer: {
      paddingHorizontal: theme.spacing[5],
      marginTop: theme.spacing[4],
      marginBottom: theme.spacing[4],
    },
    errorText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
  });

export default CoParentProfileScreen;
