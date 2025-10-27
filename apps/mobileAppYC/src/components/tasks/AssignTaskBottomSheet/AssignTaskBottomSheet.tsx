import React, {forwardRef, useImperativeHandle, useRef, useMemo} from 'react';
import {View, Image, Text, StyleSheet} from 'react-native';
import {GenericSelectBottomSheet, type SelectItem} from '@/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';
import {useSelector} from 'react-redux';
import {selectAuthUser} from '@/features/auth/selectors';
import {useTheme} from '@/hooks';

export interface AssignTaskBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface AssignTaskBottomSheetProps {
  selectedUserId?: string | null;
  onSelect: (userId: string) => void;
}

export const AssignTaskBottomSheet = forwardRef<
  AssignTaskBottomSheetRef,
  AssignTaskBottomSheetProps
>(({selectedUserId, onSelect}, ref) => {
  const {theme} = useTheme();
  const bottomSheetRef = useRef<any>(null);
  const currentUser = useSelector(selectAuthUser);

  // For now, only show current user. In future, co-users will be added here
  const users = useMemo(() => currentUser
    ? [
        {
          id: currentUser.id,
          name: currentUser.firstName || currentUser.email || 'You',
          avatar: currentUser.profilePicture,
        },
      ]
    : [], [currentUser]);

  const userItems: SelectItem[] = useMemo(() =>
    users.map(user => ({
      id: user.id,
      label: user.name,
      avatar: user.avatar,
    })), [users]
  );

  const selectedItem = selectedUserId ? {
    id: selectedUserId,
    label: users.find(u => u.id === selectedUserId)?.name || 'Unknown',
    avatar: users.find(u => u.id === selectedUserId)?.avatar,
  } : null;

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
      gap: 12,
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#EAEAEA',
    };

    const avatarStyle = {width: 40, height: 40, borderRadius: 20, resizeMode: 'cover' as const};
    const avatarPlaceholderStyle = {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.lightBlueBackground,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    };
    const avatarTextStyle = {fontSize: 18, fontWeight: '700' as const, color: theme.colors.primary};
    const nameTextStyle = {
      fontWeight: isSelected ? '600' as const : '500' as const,
      fontSize: 16,
    };
    const checkmarkContainerStyle = {
      width: 20,
      height: 20,
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    };
    const checkmarkTextStyle = {color: 'white', fontSize: 12, fontWeight: '700' as const};

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
