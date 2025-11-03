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
  onAccept?: () => void;
  onDecline?: () => void;
  onSheetChange?: (index: number) => void;
}

export const CoParentInviteBottomSheet = forwardRef<
  CoParentInviteBottomSheetRef,
  CoParentInviteBottomSheetProps
>(({coParentName = 'Pika', coParentProfileImage, companionName = 'Kizie', companionProfileImage, onAccept, onDecline, onSheetChange}, ref) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const bottomSheetRef = React.useRef<ConfirmActionBottomSheetRef>(null);
  const [agreeChecked, setAgreeChecked] = useState(false);

  const avatars = useMemo(() => {
    const avatarList = [];

    // Co-Parent avatar
    if (coParentProfileImage) {
      avatarList.push({uri: coParentProfileImage});
    } else {
      avatarList.push({placeholder: coParentName.charAt(0).toUpperCase()});
    }

    // Companion avatar
    if (companionProfileImage) {
      avatarList.push({uri: companionProfileImage});
    } else {
      avatarList.push({placeholder: companionName.charAt(0).toUpperCase()});
    }

    return avatarList;
  }, [coParentName, coParentProfileImage, companionName, companionProfileImage]);

  React.useImperativeHandle(ref, () => ({
    open: () => bottomSheetRef.current?.open(),
    close: () => bottomSheetRef.current?.close(),
  }));

  const handleAccept = () => {
    bottomSheetRef.current?.close();
    onAccept?.();
  };

  return (
    <ConfirmActionBottomSheet
      ref={bottomSheetRef}
      title={`${coParentName} as Co-Parent of ${companionName}`}
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
          Hey, {coParentName}!
        </Text>
        <Text style={styles.messageSubtitle}>
          Sky has sent Co-Parent invite to you.
        </Text>
      </View>

      {/* Checkbox Agreement */}
      <View style={styles.checkboxWrapper}>
        <Checkbox
          value={agreeChecked}
          onValueChange={setAgreeChecked}
          label={`I agree to join ${coParentName}'s care circle and share tasks, reminders and records.`}
          labelStyle={styles.checkboxLabel}
        />
      </View>
    </ConfirmActionBottomSheet>
  );
});

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      gap: theme.spacing[4],
    },
    profilesContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: theme.spacing[4],
    },
    messageContainer: {
      alignItems: 'center',
      marginVertical: theme.spacing[2],
    },
    messageTitle: {
      ...theme.typography.h4,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[1],
    },
    messageSubtitle: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
    checkboxWrapper: {
      marginVertical: theme.spacing[2],
    },
    checkboxLabel: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      lineHeight: 22,
    },
  });

export default CoParentInviteBottomSheet;
