import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Animated,
  Alert,
  Platform,
  ToastAndroid,
} from 'react-native';
import {useSelector} from 'react-redux';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {normalizeImageUri} from '@/shared/utils/imageUri';
import type {RootState} from '@/app/store';
import type {CoParentPermissions} from '@/features/coParent';

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
  const [failedImages, setFailedImages] = React.useState<Record<string, boolean>>({});
  const accessMap = useSelector(
    (state: RootState) => state.coParent?.accessByCompanionId ?? {},
  );
  const defaultAccess = useSelector((state: RootState) => state.coParent?.defaultAccess ?? null);
  const globalRole = useSelector((state: RootState) => state.coParent?.lastFetchedRole);
  const globalPermissions = useSelector(
    (state: RootState) => state.coParent?.lastFetchedPermissions,
  );
  const originalOrderRef = React.useRef<Map<string, number>>(new Map());
  React.useEffect(() => {
    const map = new Map<string, number>();
    companions.forEach((companion, index) => {
      const companionId = companion.id ?? (companion as any)._id ?? (companion as any).companionId;
      if (companionId) {
        map.set(companionId, index);
      }
    });
    originalOrderRef.current = map;
  }, [companions]);

  const resolveRolePriority = React.useCallback(
    (companion: T) => {
      const companionId =
        companion.id ?? (companion as any)._id ?? (companion as any).companionId ?? '';
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
  }, [companions, resolveRolePriority]);

  const handleImageError = React.useCallback((id: string) => {
    setFailedImages(prev => {
      if (prev[id]) {
        return prev;
      }
      return {...prev, [id]: true};
    });
  }, []);

  const showPermissionToast = React.useCallback(
    (label?: string) => {
      const message = label
        ? `You don't have access to ${label}. Ask the primary parent to enable it.`
        : "You don't have access to this companion. Ask the primary parent to enable it.";
      if (Platform.OS === 'android') {
        ToastAndroid.show(message, ToastAndroid.SHORT);
      } else {
        Alert.alert('Permission needed', message);
      }
    },
    [],
  );

  const renderCompanionBadge = (companion: T) => {
    const companionId = companion.id ?? (companion as any)._id ?? (companion as any).companionId;
    const isSelected = selectedCompanionId === companionId;
    let badgeText: string | undefined;
    if (getBadgeText) {
      badgeText = getBadgeText(companion);
    } else if (companion.taskCount !== undefined) {
      badgeText = `${companion.taskCount} Tasks`;
    }
    const avatarUri = normalizeImageUri(companion.profileImage ?? null);

    return (
      <TouchableOpacity
        key={companionId}
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
              access?.permissions ?? globalPermissions ?? defaultAccess?.permissions;
            const hasPermission = isPrimary || (permissions ? Boolean(permissions[requiredPermission]) : false);
            if (!hasPermission) {
              showPermissionToast(permissionLabel ?? requiredPermission);
              return;
            }
          }

          onSelect(companionId);
        }}>
        <View style={styles.companionItem}>
          <Animated.View
            style={[
              styles.companionAvatarRing,
              isSelected && styles.companionAvatarRingSelected,
              isSelected && {transform: [{scale: 1.08}]},
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
          </Animated.View>

          <Text
            style={styles.companionName}
            numberOfLines={1}
            ellipsizeMode="tail">
            {companion.name}
          </Text>
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
      {sortedCompanions.map(renderCompanionBadge)}
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
      textAlign: 'center',
      alignSelf: 'stretch',
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
