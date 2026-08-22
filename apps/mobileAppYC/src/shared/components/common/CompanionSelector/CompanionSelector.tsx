import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  ToastAndroid,
} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useSelector} from 'react-redux';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {normalizeImageUri} from '@/shared/utils/imageUri';
import {useLazyRef} from '@/shared/hooks/useLazyRef';
import type {RootState} from '@/app/store';
import type {CoParentPermissions} from '@/features/coParent';

import i18next from 'i18next';
export interface CompanionBase {
  id?: string;
  _id?: string;
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
  requiredPermission?: keyof CoParentPermissions;
  permissionLabel?: string;
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
  requiredPermission,
  permissionLabel,
}: CompanionSelectorProps<T>) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [failedImages, setFailedImages] = React.useState<
    Record<string, boolean>
  >({});
  const accessMap = useSelector(
    (state: RootState) => state.coParent?.accessByCompanionId ?? {},
  );
  const defaultAccess = useSelector(
    (state: RootState) => state.coParent?.defaultAccess ?? null,
  );
  const globalRole = useSelector(
    (state: RootState) => state.coParent?.lastFetchedRole,
  );
  const globalPermissions = useSelector(
    (state: RootState) => state.coParent?.lastFetchedPermissions,
  );
  const originalOrderRef = useLazyRef(() => new Map<string, number>());
  React.useEffect(() => {
    const map = new Map<string, number>();
    companions.forEach((companion, index) => {
      const companionId =
        companion.id ??
        (companion as any)._id ??
        (companion as any).companionId;
      if (companionId) {
        map.set(companionId, index);
      }
    });
    originalOrderRef.current = map;
  }, [companions, originalOrderRef]);

  const resolveRolePriority = React.useCallback(
    (companion: T) => {
      const companionId =
        companion.id ??
        (companion as any)._id ??
        (companion as any).companionId ??
        '';
      const access = accessMap?.[companionId] ?? defaultAccess ?? null;
      const role = (access?.role ?? globalRole ?? '').toUpperCase();
      if (role.includes('PRIMARY')) {
        return 0; // primary parent
      }
      if (role.includes('CO') || role.includes('COPARENT')) {
        return 1; // co-parent
      }
      return 2; // fallback/unknown role
    },
    [accessMap, defaultAccess, globalRole],
  );

  const sortedCompanions = React.useMemo(() => {
    const items = [...companions];
    return items.sort((a, b) => {
      const priorityA = resolveRolePriority(a);
      const priorityB = resolveRolePriority(b);
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      // keep original order when priorities match
      const idA =
        a.id ?? (a as any)._id ?? (a as any).companionId ?? '__missingA__';
      const idB =
        b.id ?? (b as any)._id ?? (b as any).companionId ?? '__missingB__';
      const indexA = originalOrderRef.current.get(idA) ?? 0;
      const indexB = originalOrderRef.current.get(idB) ?? 0;
      return indexA - indexB;
    });
  }, [companions, originalOrderRef, resolveRolePriority]);

  const handleImageError = React.useCallback((id: string) => {
    setFailedImages(prev => {
      if (prev[id]) {
        return prev;
      }
      return {...prev, [id]: true};
    });
  }, []);

  const showPermissionToast = React.useCallback((label?: string) => {
    const message = label
      ? `You don't have access to ${label}. Ask the primary parent to enable it.`
      : "You don't have access to this companion. Ask the primary parent to enable it.";
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert(i18next.t('alerts.shared.permissionNeeded'), message);
    }
  }, []);

  const renderCompanionBadge = (companion: T, index: number) => {
    const companionId =
      companion.id ?? (companion as any)._id ?? (companion as any).companionId;
    const companionKey = companionId ?? `companion-${index}`;
    const isSelected = selectedCompanionId === companionId;
    let badgeText: string | undefined;
    if (getBadgeText) {
      badgeText = getBadgeText(companion);
    } else if (companion.taskCount !== undefined) {
      badgeText = `${companion.taskCount} Tasks`;
    }
    const avatarUri = normalizeImageUri(companion.profileImage ?? null);

    return (
      <PressableOpacity
        key={companionKey}
        style={styles.companionTouchable}
        activeOpacity={0.88}
        onPress={() => {
          if (!companionId) {
            return;
          }

          if (requiredPermission) {
            const access = accessMap?.[companionId] ?? defaultAccess ?? null;
            const role = (access?.role ?? globalRole ?? '').toUpperCase();
            const isPrimary = role.includes('PRIMARY');
            const permissions =
              access?.permissions ??
              globalPermissions ??
              defaultAccess?.permissions;
            const hasPermission =
              isPrimary ||
              (permissions ? Boolean(permissions[requiredPermission]) : false);
            if (!hasPermission) {
              showPermissionToast(permissionLabel ?? requiredPermission);
              return;
            }
          }

          onSelect(companionId);
        }}
        accessibilityRole="radio"
        accessibilityState={{selected: isSelected}}
        accessibilityLabel={
          badgeText ? `${companion.name}, ${badgeText}` : companion.name
        }>
        <View
          style={[
            styles.companionItem,
            isSelected && styles.companionItemSelected,
          ]}>
          <View
            style={[
              styles.companionAvatarRing,
              isSelected && styles.companionAvatarRingSelected,
            ]}>
            {avatarUri && companionId && !failedImages[companionId] ? (
              <Image
                source={{uri: avatarUri}}
                style={styles.companionAvatar}
                onError={() => handleImageError(companionId)}
              />
            ) : (
              <View style={styles.companionAvatarPlaceholder}>
                <Text style={styles.companionAvatarInitial}>
                  {companion.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <Text
            style={styles.companionName}
            numberOfLines={1}
            ellipsizeMode="tail">
            {companion.name}
          </Text>
          {badgeText && <Text style={styles.companionMeta}>{badgeText}</Text>}
        </View>
      </PressableOpacity>
    );
  };

  const renderAddCompanionBadge = () => (
    <PressableOpacity
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
    </PressableOpacity>
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={containerStyle}>
      <View style={styles.companionRow}>
        {sortedCompanions.map((companion, index) =>
          renderCompanionBadge(companion, index),
        )}
        {showAddButton && onAddCompanion && renderAddCompanionBadge()}
      </View>
    </ScrollView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    companionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing['1'],
    },
    companionTouchable: {
      width: 96,
    },
    companionItem: {
      alignItems: 'center',
      gap: theme.spacing['2'],
      paddingVertical: theme.spacing['3'],
      paddingHorizontal: theme.spacing['2'],
      borderRadius: theme.borderRadius.cardSmall,
      borderWidth: 1.5,
      borderColor: theme.colors.hairline,
      backgroundColor: theme.colors.screen2,
    },
    // Pink = companion moment: the selected tile gets a pink border + soft glow.
    companionItemSelected: {
      borderColor: theme.colors.pink,
      backgroundColor: theme.colors.screen,
      ...theme.shadows.companion,
    },
    // Selected companion = a pink ring encircling the round avatar (the design's
    // signature "encircle" selection). The reserved 2.5px border keeps layout
    // stable and turns pink only when selected, with a small gap to the avatar.
    companionAvatarRing: {
      width: 60,
      height: 60,
      borderRadius: theme.borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2.5,
      borderColor: theme.colors.transparent,
    },
    companionAvatarRingSelected: {
      borderColor: theme.colors.pink,
    },
    companionAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      resizeMode: 'cover',
    },
    companionAvatarPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.blueSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    companionAvatarInitial: {
      ...theme.typography.titleMedium,
      color: theme.colors.blueText,
      fontWeight: '700',
    },
    companionName: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
      textAlign: 'center',
      alignSelf: 'stretch',
    },
    companionMeta: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.blueText,
    },
    addCompanionItem: {
      alignItems: 'center',
      gap: theme.spacing['2'],
      paddingVertical: theme.spacing['3'],
      paddingHorizontal: theme.spacing['2'],
      borderRadius: theme.borderRadius.cardSmall,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: theme.colors.divider,
      backgroundColor: theme.colors.screen2,
    },
    addCompanionCircle: {
      width: 56,
      height: 56,
      borderRadius: theme.borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.screen,
    },
    addCompanionIcon: {
      width: 28,
      height: 28,
      resizeMode: 'contain',
    },
    addCompanionLabel: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.blueText,
      textAlign: 'center',
    },
  });
