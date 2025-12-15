import React, {useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import {useTheme} from '@/hooks';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';

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
    <LiquidGlassCard
      glassEffect="clear"
      interactive
      style={styles.container}
      fallbackStyle={styles.containerFallback}>
      <View style={styles.content}>
        <Text style={styles.title}>Invite from {businessName}</Text>

        <Text style={styles.description}>
          Hey {companionName}! It seems like you already have an account at {businessName} Organisation. Please
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
          <LiquidGlassButton
            title="Don't Know"
            onPress={onDecline}
            glassEffect="clear"
            tintColor={theme.colors.surface}
            borderRadius="md"
            textStyle={styles.declineButtonText}
            style={styles.button}
            forceBorder
            borderColor={theme.colors.border}
          />
          <LiquidGlassButton
            title="Yes, It's me"
            onPress={onAccept}
            glassEffect="clear"
            tintColor={theme.colors.secondary}
            borderRadius="md"
            textStyle={styles.acceptButtonText}
            style={styles.button}
          />
        </View>
      </View>
    </LiquidGlassCard>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      gap: theme.spacing[4],
    },
    containerFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.white,
    },
    content: {
      gap: theme.spacing[4],
      paddingHorizontal: theme.spacing[3],
      paddingBottom: theme.spacing[5],
      paddingTop: theme.spacing[4],
    },
    title: {
      ...theme.typography.h4Alt,
      color: theme.colors.text,
    },
    description: {
      ...theme.typography.labelXsBold,
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    detailsContainer: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.md,
      paddingBlock: theme.spacing[3],
      gap: theme.spacing[2],
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    label: {
      ...theme.typography.bodyExtraSmall,
      color: theme.colors.textSecondary,
    },
    value: {
      ...theme.typography.captionBoldSatoshi,
      color: theme.colors.text,
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing[3],
    },
    button: {
      flex: 1,
    },
    declineButtonText: {
      ...theme.typography.titleSmall,
      textAlign: 'center',
      color: theme.colors.secondary,
    },
    acceptButtonText: {
      ...theme.typography.titleSmall,
      textAlign: 'center',
      color: theme.colors.white,
    },
  });

export default InviteCard;
