import React, {forwardRef, useState, useMemo} from 'react';
import {View, StyleSheet, Text} from 'react-native';
import {ConfirmActionBottomSheet, ConfirmActionBottomSheetRef} from '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet';
import {Checkbox} from '@/shared/components/common/Checkbox/Checkbox';
import {AvatarGroup} from '@/shared/components/common/AvatarGroup/AvatarGroup';
import {useTheme} from '@/hooks';

export interface CoParentInviteBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface CoParentInviteBottomSheetProps {
  coParentName?: string;
  coParentProfileImage?: string;
  companionName?: string;
  companionProfileImage?: string;
  inviterName?: string;
  inviterProfileImage?: string;
  inviteeName?: string;
  onAccept?: () => void;
  onDecline?: () => void;
  onSheetChange?: (index: number) => void;
  bottomInset?: number;
}

export const CoParentInviteBottomSheet = forwardRef<
  CoParentInviteBottomSheetRef,
  CoParentInviteBottomSheetProps
>(({coParentName, coParentProfileImage, companionName, companionProfileImage, inviterName, inviterProfileImage, inviteeName, onAccept, onDecline, onSheetChange, bottomInset}, ref) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const bottomSheetRef = React.useRef<ConfirmActionBottomSheetRef>(null);
  const [agreeChecked, setAgreeChecked] = useState(false);

  const avatars = useMemo(() => {
    const avatarList = [];

    const inviterAvatarInitial = inviterName?.charAt(0).toUpperCase() || coParentName?.charAt(0).toUpperCase() || 'P';
    const companionAvatarInitial = companionName?.charAt(0).toUpperCase() || 'C';

    // Inviter avatar
    if (inviterProfileImage || coParentProfileImage) {
      avatarList.push({uri: inviterProfileImage ?? coParentProfileImage});
    } else {
      avatarList.push({placeholder: inviterAvatarInitial});
    }

    // Companion avatar
    if (companionProfileImage) {
      avatarList.push({uri: companionProfileImage});
    } else {
      avatarList.push({placeholder: companionAvatarInitial});
    }

    return avatarList;
  }, [coParentName, coParentProfileImage, companionName, companionProfileImage, inviterName, inviterProfileImage]);

  const resolvedCompanionName = companionName || 'your companion';
  const resolvedInviterName = inviterName || coParentName || 'Someone';
  const resolvedInviteeName = inviteeName || coParentName || 'you';

  React.useImperativeHandle(ref, () => ({
    open: () => bottomSheetRef.current?.open(),
    close: () => bottomSheetRef.current?.close(),
  }));

  const handleAccept = () => {
    bottomSheetRef.current?.close();
    onAccept?.();
  };

  React.useEffect(() => {
    setAgreeChecked(false);
  }, [coParentName, companionName, inviterName, inviteeName]);

  return (
    <ConfirmActionBottomSheet
      ref={bottomSheetRef}
      title={`${resolvedInviterName} invited you to join ${resolvedCompanionName}`}
      snapPoints={['65%']}
      primaryButton={{
        label: 'Accept',
        onPress: handleAccept,
        disabled: !agreeChecked,
      }}
      secondaryButton={{
        label: 'Decline',
        onPress: () => {
          bottomSheetRef.current?.close();
          onDecline?.();
        },
      }}
      bottomInset={bottomInset}
      zIndex={200}
      onSheetChange={onSheetChange}
      containerStyle={styles.container}>
      {/* Profile Images Section */}
      <View style={styles.profilesContainer}>
        <AvatarGroup
          avatars={avatars}
          size={80}
          overlap={-20}
        />
      </View>


      {/* Profile Message */}
      <View style={styles.messageContainer}>
        <Text style={styles.messageTitle}>
          Hey, {resolvedInviteeName}!
        </Text>
        <Text style={styles.messageSubtitle}>
          {resolvedInviterName} has sent a co-parent invite for {resolvedCompanionName}.
        </Text>
      </View>

      {/* Checkbox Agreement */}
      <View style={styles.checkboxWrapper}>
        <Checkbox
          value={agreeChecked}
          onValueChange={setAgreeChecked}
          label={`I agree to join ${resolvedInviterName}'s care circle for ${resolvedCompanionName} and share tasks, reminders and records.`}
          labelStyle={styles.checkboxLabel}
        />
      </View>
    </ConfirmActionBottomSheet>
  );
});

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      gap: theme.spacing['4'],
    },
    profilesContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: theme.spacing['4'],
    },
    messageContainer: {
      alignItems: 'center',
      marginVertical: theme.spacing['2'],
    },
    messageTitle: {
      ...theme.typography.h4,
      color: theme.colors.secondary,
      marginBottom: theme.spacing['1'],
    },
    messageSubtitle: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
    checkboxWrapper: {
      marginVertical: theme.spacing['2'],
    },
    checkboxLabel: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      lineHeight: 22,
    },
  });

export default CoParentInviteBottomSheet;
