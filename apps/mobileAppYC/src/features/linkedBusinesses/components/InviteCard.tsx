import React, {useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {useTheme} from '@/hooks';

interface InviteCardProps {
  businessName: string;
  parentName: string;
  companionName: string;
  email: string;
  phone: string;
  onAccept: () => void;
  onDecline: () => void;
}

export const InviteCard: React.FC<InviteCardProps> = ({
  businessName,
  parentName,
  companionName,
  email,
  phone,
  onAccept,
  onDecline,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Invite from {businessName}</Text>

      <Text style={styles.description}>
        Hey Sky! It seems like you already have an account at {businessName} Organisation. Please
        confirm if its you or not?
      </Text>

      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Parent Name:</Text>
          <Text style={styles.value}>{parentName}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Companion Name:</Text>
          <Text style={styles.value}>{companionName}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Email ID:</Text>
          <Text style={styles.value}>{email}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Mobile number:</Text>
          <Text style={styles.value}>{phone}</Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.declineButton}
          onPress={onDecline}
          activeOpacity={0.7}>
          <Text style={styles.declineButtonText}>Don't Know</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={onAccept}
          activeOpacity={0.7}>
          <Text style={styles.acceptButtonText}>Yes, Its me</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing[4],
      marginBottom: theme.spacing[4],
    },
    title: {
      ...theme.typography.h5,
      color: theme.colors.text,
      marginBottom: theme.spacing[2],
    },
    description: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing[4],
      lineHeight: 20,
    },
    detailsContainer: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing[3],
      marginBottom: theme.spacing[4],
      gap: theme.spacing[2],
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    label: {
      ...theme.typography.labelSmBold,
      color: theme.colors.textSecondary,
    },
    value: {
      ...theme.typography.labelSmBold,
      color: theme.colors.text,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: theme.spacing[3],
    },
    declineButton: {
      flex: 1,
      paddingVertical: theme.spacing[3],
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    declineButtonText: {
      ...theme.typography.buttonMd,
      color: theme.colors.secondary,
    },
    acceptButton: {
      flex: 1,
      paddingVertical: theme.spacing[3],
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    acceptButtonText: {
      ...theme.typography.buttonMd,
      color: theme.colors.white,
    },
  });

export default InviteCard;
