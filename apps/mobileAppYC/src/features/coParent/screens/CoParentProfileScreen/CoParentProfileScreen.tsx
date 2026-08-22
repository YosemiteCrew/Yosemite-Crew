import React, {useMemo, useState} from 'react';
import {View, StyleSheet, ScrollView, Image, Text, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch} from '@/app/store';
import type {Theme} from '@/theme';
import {useTheme} from '@/hooks';
import {Header} from '@/shared/components/common/Header/Header';
import {Badge, SkeletonDetail} from '@/shared/components/common';
import type {BadgeTone} from '@/shared/components/common';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {normalizeImageUri} from '@/shared/utils/imageUri';
import {addCoParent} from '../../thunks';
import {selectCoParentById, selectCoParentLoading} from '../../selectors';
import type {CoParentStackParamList} from '@/navigation/types';
import AddCoParentBottomSheet from '../../components/AddCoParentBottomSheet/AddCoParentBottomSheet';
import CoParentInviteBottomSheet from '../../components/CoParentInviteBottomSheet/CoParentInviteBottomSheet';
import {useCoParentInviteFlow} from '../../hooks/useCoParentInviteFlow';
import {createCommonCoParentStyles} from '../../styles/commonStyles';
import {selectCompanions} from '@/features/companion';

import i18next from 'i18next';
type Props = NativeStackScreenProps<CoParentStackParamList, 'CoParentProfile'>;

export const CoParentProfileScreen: React.FC<Props> = ({route, navigation}) => {
  const {coParentId} = route.params;
  const {theme} = useTheme();
  const commonStyles = useMemo(
    () => createCommonCoParentStyles(theme),
    [theme],
  );
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();

  const coParentFromStore = useSelector(state =>
    selectCoParentById(coParentId)(state as any),
  );
  const coParent = coParentFromStore ?? null;
  const isCoParentLoading = useSelector(selectCoParentLoading);
  const loading = isCoParentLoading && !coParent;
  const [sendingInvite, setSendingInvite] = useState(false);
  const companions = useSelector(selectCompanions);

  // The companion this co-parent record is actually for — never the
  // account's first companion, which may be a different pet entirely when
  // the account has more than one. Used for both the resend-invite call and
  // the invite-confirmation sheet below.
  const targetCompanionId = coParent?.companionId ?? null;
  const targetCompanionFromRecord = coParent?.companions.find(
    c => c.companionId === targetCompanionId,
  );
  const targetCompanionFallback = companions.find(
    c => c.id === targetCompanionId,
  );
  const targetCompanionName =
    targetCompanionFromRecord?.companionName ?? targetCompanionFallback?.name;
  const targetCompanionImage =
    targetCompanionFromRecord?.profileImage ??
    targetCompanionFallback?.profileImage ??
    undefined;

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

  const handleBack = () => {
    navigation.goBack();
  };

  const handleSendInvite = async () => {
    const companionId = targetCompanionId;

    if (!coParent || !companionId) {
      Alert.alert(
        i18next.t('alerts.shared.error'),
        i18next.t('alerts.coParent.errorBody8'),
      );
      return;
    }

    const inviteEmail = coParent.email?.trim();
    if (!inviteEmail) {
      Alert.alert(
        i18next.t('alerts.coParent.missingEmail'),
        i18next.t('alerts.coParent.missingEmailBody'),
      );
      return;
    }
    const inviteName =
      `${coParent.firstName ?? ''} ${coParent.lastName ?? ''}`.trim();
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
          companionName: targetCompanionName,
          companionImage: targetCompanionImage,
        }),
      ).unwrap();

      // Show success bottom sheet
      addCoParentSheetRef.current?.open();
    } catch (error) {
      console.error('Failed to send invite:', error);
      Alert.alert(
        i18next.t('alerts.shared.error'),
        i18next.t('alerts.coParent.errorBody7'),
      );
    } finally {
      setSendingInvite(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <Header title="Co-parent" showBackButton onBack={handleBack} />
        <SkeletonDetail />
      </SafeAreaView>
    );
  }

  if (!coParent) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <Header title="Co-parent" showBackButton onBack={handleBack} />
        <View style={commonStyles.centerContent}>
          <Text style={styles.errorText}>Co-Parent not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = `${coParent.firstName ?? ''} ${
    coParent.lastName ?? ''
  }`.trim();
  const heroInitial = (
    coParent.firstName ||
    coParent.lastName ||
    coParent.email ||
    'C'
  )
    .trim()
    .charAt(0)
    .toUpperCase();
  const heroSubtitle =
    coParent.companions.length > 0
      ? `Caring for ${coParent.companions
          .flatMap(companion =>
            companion.companionName ? [companion.companionName] : [],
          )
          .join(', ')}`
      : '';
  const statusLabel = (coParent.status ?? '').trim();
  const statusTone: BadgeTone = /active|accepted/i.test(statusLabel)
    ? 'success'
    : 'warning';
  const accessItems = [
    {key: 'appointments', label: 'Appointments'},
    {key: 'documents', label: 'Documents'},
    {key: 'tasks', label: 'Tasks'},
    {key: 'expenses', label: 'Expenses'},
    {key: 'chatWithVet', label: 'Chat with vet'},
    {key: 'emergency', label: 'Emergency'},
  ].filter(item => {
    const perms = coParent.permissions;
    switch (item.key) {
      case 'emergency':
        return perms?.emergencyBasedPermissions;
      case 'chatWithVet':
        return perms?.chatWithVet;
      default:
        return (perms as unknown as Record<string, boolean> | undefined)?.[
          item.key
        ];
    }
  });

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <Header title="Co-parent" showBackButton onBack={handleBack} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* Profile hero */}
        <View style={styles.hero}>
          {coParent.profilePicture ? (
            <Image
              source={{uri: coParent.profilePicture}}
              style={styles.heroAvatar}
            />
          ) : (
            <View style={styles.heroAvatarInitials}>
              <Text style={styles.heroInitialsText}>{heroInitial}</Text>
            </View>
          )}
          {displayName.length > 0 && (
            <Text style={styles.heroName}>{displayName}</Text>
          )}
          {heroSubtitle.length > 0 && (
            <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
          )}
          {statusLabel.length > 0 && (
            <Badge
              label={statusLabel.toUpperCase()}
              tone={statusTone}
              size="sm"
              style={styles.heroBadge}
            />
          )}
        </View>

        {/* Parent Details */}
        <View style={styles.sectionContainer}>
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Name</Text>
              <Text style={styles.detailValue}>{displayName || 'N/A'}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone number</Text>
              <Text style={styles.detailValue}>
                {coParent.phoneNumber || 'N/A'}
              </Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>{coParent.email ?? 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* Access */}
        {accessItems.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Access</Text>
            <View style={styles.chipRow}>
              {accessItems.map(item => (
                <View key={item.key} style={styles.chip}>
                  <Text style={styles.chipText}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Companion Details */}
        {coParent.companions.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Companion details</Text>
            <View style={styles.detailCard}>
              {coParent.companions.map((companion, index) => (
                <View key={companion.companionId}>
                  <View style={styles.companionRow}>
                    {companion.profileImage ? (
                      <Image
                        source={{
                          uri: normalizeImageUri(companion.profileImage) ?? '',
                        }}
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
                      <Text style={styles.companionName}>
                        {companion.companionName}
                      </Text>
                      <Text style={styles.companionBreed}>
                        {companion.breed || 'Unknown'}
                      </Text>
                    </View>
                  </View>
                  {index < coParent.companions.length - 1 && (
                    <View style={styles.detailDivider} />
                  )}
                </View>
              ))}
            </View>
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
        companionName={targetCompanionName || 'Companion'}
        companionProfileImage={targetCompanionImage}
        onAccept={handleInviteAccept}
        onDecline={handleInviteDecline}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      paddingBottom: theme.spacing['10'],
    },
    hero: {
      alignItems: 'center',
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['6'],
      paddingBottom: theme.spacing['5'],
      gap: theme.spacing['1'],
    },
    heroAvatar: {
      width: 84,
      height: 84,
      borderRadius: theme.borderRadius.full,
    },
    heroAvatarInitials: {
      width: 84,
      height: 84,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.avatarGreenBg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    heroInitialsText: {
      ...theme.typography.emptyStateTitle,
      color: theme.colors.avatarGreenInk,
    },
    heroName: {
      ...theme.typography.serifTitleSmall,
      color: theme.colors.ink,
      marginTop: theme.spacing['2'],
      textAlign: 'center',
    },
    heroSubtitle: {
      ...theme.typography.bodySmall,
      color: theme.colors.inkFaint,
      textAlign: 'center',
    },
    heroBadge: {
      marginTop: theme.spacing['2'],
    },
    sectionContainer: {
      paddingHorizontal: theme.spacing['5'],
      marginBottom: theme.spacing['5'],
    },
    sectionTitle: {
      ...theme.typography.bodyBold,
      color: theme.colors.ink,
      marginBottom: theme.spacing['3'],
    },
    detailCard: {
      backgroundColor: theme.colors.screen2,
      borderRadius: theme.borderRadius.cardSmall,
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['1'],
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing['3'],
      gap: theme.spacing['3'],
    },
    detailLabel: {
      ...theme.typography.bodySmall,
      color: theme.colors.inkMuted,
    },
    detailValue: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.inkBody,
      flex: 1,
      textAlign: 'right',
    },
    detailDivider: {
      height: 1,
      backgroundColor: theme.colors.hairline,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing['2'],
    },
    chip: {
      paddingHorizontal: theme.spacing['3'],
      paddingVertical: theme.spacing['2'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.blueSoft,
    },
    chipText: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.navActive,
    },
    companionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing['3'],
      gap: theme.spacing['3'],
    },
    companionAvatar: {
      width: theme.spacing['12'],
      height: theme.spacing['12'],
      borderRadius: theme.borderRadius.full,
    },
    companionAvatarInitials: {
      width: theme.spacing['12'],
      height: theme.spacing['12'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.blueSoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarInitialsText: {
      ...theme.typography.bodyBold,
      color: theme.colors.navActive,
    },
    companionInfo: {
      flex: 1,
    },
    companionName: {
      ...theme.typography.bodyBold,
      color: theme.colors.ink,
    },
    companionBreed: {
      ...theme.typography.bodySmall,
      color: theme.colors.inkMuted,
    },
    sendButtonContainer: {
      paddingHorizontal: theme.spacing['5'],
      marginTop: theme.spacing['4'],
      marginBottom: theme.spacing['4'],
    },
    errorText: {
      ...theme.typography.body,
      color: theme.colors.inkMuted,
    },
  });

export default CoParentProfileScreen;
