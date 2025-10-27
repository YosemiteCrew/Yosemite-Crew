import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

export interface CompanionBase {
  id: string;
  name: string;
  profileImage?: string | null;
  taskCount?: number;
}

interface CompanionSelectorProps<T extends CompanionBase = CompanionBase> {
  companions: T[];
  selectedCompanionId: string | null;
  onSelect: (id: string) => void;
  onAddCompanion?: () => void;
  showAddButton?: boolean;
  containerStyle?: any;
  /**
   * Function to generate dynamic badge text for each companion
   * @param companion - The companion object
   * @returns The text to display below the companion name (e.g., "3 Tasks", "Dog")
   */
  getBadgeText?: (companion: T) => string;
}

export const CompanionSelector = <T extends CompanionBase = CompanionBase>({
  companions,
  selectedCompanionId,
  onSelect,
  onAddCompanion,
  showAddButton = true,
  containerStyle,
  getBadgeText,
}: CompanionSelectorProps<T>) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const renderCompanionBadge = (companion: T) => {
    const isSelected = selectedCompanionId === companion.id;
    let badgeText: string | undefined;
    if (getBadgeText) {
      badgeText = getBadgeText(companion);
    } else if (companion.taskCount !== undefined) {
      badgeText = `${companion.taskCount} Tasks`;
    }

    return (
      <TouchableOpacity
        key={companion.id}
        style={styles.companionTouchable}
        activeOpacity={0.88}
        onPress={() => onSelect(companion.id)}>
        <View style={styles.companionItem}>
          <Animated.View
            style={[
              styles.companionAvatarRing,
              isSelected && styles.companionAvatarRingSelected,
              isSelected && {transform: [{scale: 1.08}]},
            ]}>
            {companion.profileImage ? (
              <Image
                source={{uri: companion.profileImage}}
                style={styles.companionAvatar}
              />
            ) : (
              <View style={styles.companionAvatarPlaceholder}>
                <Text style={styles.companionAvatarInitial}>
                  {companion.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </Animated.View>

          <Text style={styles.companionName}>{companion.name}</Text>
          {badgeText && (
            <Text style={styles.companionMeta}>
              {badgeText}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderAddCompanionBadge = () => (
    <TouchableOpacity
      key="add-companion"
      style={styles.companionTouchable}
      activeOpacity={0.85}
      onPress={onAddCompanion}>
      <View style={styles.addCompanionItem}>
        <View style={styles.addCompanionCircle}>
          <Image source={Images.blueAddIcon} style={styles.addCompanionIcon} />
        </View>
        <Text style={styles.addCompanionLabel}>Add companion</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.companionRow, containerStyle]}>
      {companions.map(renderCompanionBadge)}
      {showAddButton && onAddCompanion && renderAddCompanionBadge()}
    </ScrollView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    companionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing[1],
    },
    companionTouchable: {
      width: 96,
    },
    companionItem: {
      alignItems: 'center',
      gap: theme.spacing[2.5],
    },
    companionAvatarRing: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: 2,
      borderColor: theme.colors.primaryTint,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: theme.colors.cardBackground,
    },
    companionAvatarRingSelected: {
      borderColor: theme.colors.primary,
    },
    companionAvatar: {
      width: '90%',
      height: '90%',
      borderRadius: theme.borderRadius.full,
      resizeMode: 'cover',
    },
    companionAvatarPlaceholder: {
      width: '90%',
      height: '90%',
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.lightBlueBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    companionAvatarInitial: {
      ...theme.typography.titleMedium,
      color: theme.colors.primary,
      fontWeight: '700',
    },
    companionName: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
    },
    companionMeta: {
      ...theme.typography.labelXsBold,
      color: theme.colors.primary,
    },
    addCompanionItem: {
      alignItems: 'center',
      gap: theme.spacing[2.5],
    },
    addCompanionCircle: {
      width: 64,
      height: 64,
      marginBottom: theme.spacing[2.5],
      borderRadius: 32,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: theme.colors.primaryTintStrong,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primarySurface,
    },
    addCompanionIcon: {
      width: 28,
      height: 28,
      resizeMode: 'contain',
    },
    addCompanionLabel: {
      ...theme.typography.labelXsBold,
      color: theme.colors.primary,
      textAlign: 'center',
    },
  });
