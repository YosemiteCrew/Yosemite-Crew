import React, {forwardRef, useImperativeHandle, useRef, useMemo} from 'react';
import {View, Image, Text, StyleSheet} from 'react-native';
import {GenericSelectBottomSheet, type SelectItem} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';
import {useSelector} from 'react-redux';
import {selectAuthUser} from '@/features/auth/selectors';
import {useTheme} from '@/hooks';
import type {RootState} from '@/app/store';
import {selectAcceptedCoParents} from '@/features/coParent/selectors';
import {normalizeImageUri} from '@/shared/utils/imageUri';

export interface AssignTaskBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface AssignTaskBottomSheetProps {
  selectedUserId?: string | null;
  onSelect: (userId: string) => void;
  onSheetChange?: (index: number) => void;
}

export const AssignTaskBottomSheet = forwardRef<
  AssignTaskBottomSheetRef,
  AssignTaskBottomSheetProps
>(({selectedUserId, onSelect, onSheetChange}, ref) => {
  const {theme} = useTheme();
  const bottomSheetRef = useRef<any>(null);
  const currentUser = useSelector(selectAuthUser);
  const coParents = useSelector(selectAcceptedCoParents);
  const selectedCompanionId = useSelector((state: RootState) => state.companion.selectedCompanionId);

  const normalizedCurrentUser = useMemo(() => {
    if (!currentUser) {
      return null;
    }
    return {
      id: currentUser.parentId ?? currentUser.id,
      name: currentUser.firstName || currentUser.email || 'You',
      avatar: normalizeImageUri(currentUser.profilePicture) ?? undefined,
    };
  }, [currentUser]);

  const assignableCoParents = useMemo(() => {
    if (!selectedCompanionId) {
      return [];
    }
    return coParents.filter(
      cp =>
        cp.companionId === selectedCompanionId &&
        (cp.role ?? '').toLowerCase() !== 'primary' &&
        (cp.permissions?.tasks ?? true) &&
        (cp.status ?? '').toLowerCase() === 'accepted',
    );
  }, [coParents, selectedCompanionId]);

  const coParentUsers = useMemo(
    () =>
      assignableCoParents.map(cp => ({
        id: cp.parentId || cp.id || cp.userId,
        name:
          [cp.firstName, cp.lastName].filter(Boolean).join(' ').trim() ||
          cp.email ||
          'Co-parent',
        avatar: normalizeImageUri(cp.profilePicture) ?? undefined,
      })),
    [assignableCoParents],
  );

  const users = useMemo(() => {
    const list = [];
    if (normalizedCurrentUser) {
      list.push(normalizedCurrentUser);
    }
    list.push(...coParentUsers);
    // Deduplicate by id to avoid showing current user twice
    const seen = new Set<string>();
    return list.filter(user => {
      if (!user.id) return false;
      if (seen.has(user.id)) return false;
      seen.add(user.id);
      return true;
    });
  }, [coParentUsers, normalizedCurrentUser]);

  const userItems: SelectItem[] = useMemo(() =>
    users.map(user => ({
      id: user.id,
      label: user.name,
      avatar: user.avatar,
    })), [users]
  );

  const selectedItem = selectedUserId
    ? (() => {
        const user = users.find(u => u.id === selectedUserId);
        return {
          id: selectedUserId,
          label: user?.name || 'Unknown',
          avatar: user?.avatar,
        };
      })()
    : null;

  useImperativeHandle(ref, () => ({
    open: () => {
      bottomSheetRef.current?.open();
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
  }));

  const handleSave = (item: SelectItem | null) => {
    if (item) {
      onSelect(item.id);
    }
  };

  const renderUserItem = (item: SelectItem, isSelected: boolean) => {
    const containerStyle = {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: theme.spacing['3'],
      flex: 1,
      paddingVertical: theme.spacing['3'],
      paddingHorizontal: theme.spacing['4'],
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    };

    const avatarStyle = {width: 40, height: 40, borderRadius: theme.borderRadius.full, resizeMode: 'cover' as const};
    const avatarPlaceholderStyle = {
      width: 40,
      height: 40,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.lightBlueBackground,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    };
    const avatarTextStyle = {...theme.typography.bodyLarge, fontWeight: '700' as const, color: theme.colors.primary};
    const nameTextStyle = {
      ...theme.typography.bodyMedium,
      fontWeight: isSelected ? '600' as const : '500' as const,
    };
    const checkmarkContainerStyle = {
      width: 20,
      height: 20,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.full,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    };
    const checkmarkTextStyle = {...theme.typography.labelSmall, color: theme.colors.white, fontWeight: '700' as const};

    return (
      <View style={containerStyle}>
        {item.avatar ? (
          <Image source={{uri: item.avatar}} style={avatarStyle} />
        ) : (
          <View style={avatarPlaceholderStyle}>
            <Text style={avatarTextStyle}>
              {item.label.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.flexOne}>
          <Text style={nameTextStyle}>
            {item.label}
          </Text>
        </View>
        {isSelected && (
          <View style={checkmarkContainerStyle}>
            <Text style={checkmarkTextStyle}>✓</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <GenericSelectBottomSheet
      ref={bottomSheetRef}
      title="Assign task to"
      items={userItems}
      selectedItem={selectedItem}
      onSave={handleSave}
      hasSearch={false}
      mode="select"
      renderItem={renderUserItem}
      snapPoints={['25%', '35%']}
      emptyMessage="No users available"
      onSheetChange={onSheetChange}
    />
  );
});

AssignTaskBottomSheet.displayName = 'AssignTaskBottomSheet';

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
  },
});

export default AssignTaskBottomSheet;
