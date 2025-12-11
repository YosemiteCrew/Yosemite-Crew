import React, { useState, forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
} from 'react-native';
import CustomBottomSheet from '@/shared/components/common/BottomSheet/BottomSheet';
import type { BottomSheetRef } from '@/shared/components/common/BottomSheet/BottomSheet';
import {BottomSheetHeader} from '@/shared/components/common/BottomSheetHeader/BottomSheetHeader';
import { Input } from '@/shared/components/common/Input/Input';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import { useTheme } from '@/hooks';
import { Images } from '@/assets/images';

export interface GenericSelectBottomSheetRef {
  open: () => void;
  close: () => void;
}

export interface SelectItem {
  id: string;
  label: string;
  [key: string]: any;
}

interface GenericSelectBottomSheetProps {
  title: string;
  items: SelectItem[];
  selectedItem: SelectItem | null;
  onSave: (item: SelectItem | null) => void;
  onItemSelect?: (item: SelectItem | null) => void; // Called when item is selected (in confirm mode)
  renderItem?: (item: SelectItem, isSelected: boolean) => React.ReactElement;
  searchPlaceholder?: string;
  snapPoints?: [string, string];
  hasSearch?: boolean;
  emptyMessage?: string;
  customContent?: React.ReactNode;
  mode?: 'select' | 'confirm'; // 'select' = auto-close on select, 'confirm' = show save/cancel buttons
  maxListHeight?: number;
  onSheetChange?: (index: number) => void;
}

export const GenericSelectBottomSheet = forwardRef<
  GenericSelectBottomSheetRef,
  GenericSelectBottomSheetProps
>(({
  title,
  items,
  selectedItem,
  onSave,
  onItemSelect,
  renderItem,
  searchPlaceholder = "Search",
  snapPoints = ['90%', '95%'],
  hasSearch = true,
  emptyMessage = "No items available",
  customContent,
  mode = 'confirm',
  maxListHeight = 400,
  onSheetChange,
}, ref) => {
  const { theme } = useTheme();
  const bottomSheetRef = useRef<BottomSheetRef>(null);

  // Track whether the sheet is open so we only render the backdrop when visible.
  const [isSheetVisible, setIsSheetVisible] = useState(false);

  const [tempItem, setTempItem] = useState<SelectItem | null>(selectedItem);
  const [searchQuery, setSearchQuery] = useState('');

  const styles = createStyles(theme, maxListHeight);
  const searchIconSource = Images?.searchIcon ?? null;

  const filteredItems = useMemo(() => {
    if (!hasSearch || !searchQuery.trim()) return items;

    const query = searchQuery.toLowerCase();
    return items.filter(item =>
      item.label.toLowerCase().includes(query)
    );
  }, [items, searchQuery, hasSearch]);

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        {emptyMessage}
      </Text>
    </View>
  );

  const handleItemPress = (item: SelectItem) => {
    if (mode === 'select') {
      // Auto-select mode: immediately save and close
      onSave(item);
      bottomSheetRef.current?.close();
    } else {
      // Confirm mode: just update temp selection
      setTempItem(item);
      // Notify parent of intermediate selection
      onItemSelect?.(item);
    }
  };

  const defaultRenderItem = ({ item }: { item: SelectItem }) => {
    const isSelected = mode === 'select'
      ? selectedItem?.id === item.id
      : tempItem?.id === item.id;

    return (
      <TouchableOpacity
        style={[styles.item, isSelected && styles.itemSelected]}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}>
        <Text style={styles.itemLabel}>{item.label}</Text>
        {isSelected && (
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  useImperativeHandle(ref, () => ({
    open: () => {
      setTempItem(selectedItem);
      setSearchQuery('');
  // mark visible before snapping so backdrop mounts correctly
  setIsSheetVisible(true);
  bottomSheetRef.current?.snapToIndex(0);
    },
    close: () => {
  bottomSheetRef.current?.close();
    },
  }));

  const handleSave = () => {
    onSave(tempItem);
    bottomSheetRef.current?.close();
  };

  const handleCancel = () => {
    setTempItem(selectedItem);
    setSearchQuery('');
    bottomSheetRef.current?.close();
  };

  return (
    <CustomBottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      initialIndex={-1}
      onChange={index => {
        // Gorhom BottomSheet returns -1 when fully closed
        setIsSheetVisible(index !== -1);
        onSheetChange?.(index);
      }}
      enablePanDownToClose
      enableDynamicSizing={false}
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      enableOverDrag={false}
      // Only show the backdrop when the sheet is actually visible
      enableBackdrop={isSheetVisible}
      backdropOpacity={0.5}
      backdropAppearsOnIndex={0}
      backdropDisappearsOnIndex={-1}
      backdropPressBehavior="close"
      contentType="view"
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.bottomSheetHandle}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize">
      <View style={styles.container}>
        {/* Header */}
        <BottomSheetHeader
          title={title}
          onClose={handleCancel}
          theme={theme}
        />

        {/* Custom Content */}
        {customContent}

        {/* Search */}
        {hasSearch && (
          <View style={styles.searchContainer}>
            <Input
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={searchPlaceholder}
              icon={
                searchIconSource ? (
                  <Image source={searchIconSource} style={styles.searchIconImage} />
                ) : undefined
              }
              containerStyle={styles.searchInputContainer}
            />
          </View>
        )}

        {/* List */}
        <View style={styles.listWrapper}>
          <FlatList
            data={filteredItems}
            keyExtractor={item => item.id}
            renderItem={({ item }) => {
              const isSelected = mode === 'select'
                ? selectedItem?.id === item.id
                : tempItem?.id === item.id;

              if (renderItem) {
                return (
                  <TouchableOpacity
                    style={styles.touchableItem}
                    onPress={() => handleItemPress(item)}
                    activeOpacity={0.7}>
                    {renderItem(item, isSelected)}
                  </TouchableOpacity>
                );
              }

              return defaultRenderItem({ item });
            }}
            showsVerticalScrollIndicator
            contentContainerStyle={styles.listContent}
            nestedScrollEnabled
            ListEmptyComponent={renderEmptyList}
          />
        </View>

        {/* Buttons - Only shown in confirm mode */}
        {mode === 'confirm' && (
          <View style={styles.buttonContainer}>
            <LiquidGlassButton
              title="Cancel"
              onPress={handleCancel}
              style={styles.cancelButton}
              textStyle={styles.cancelButtonText}
              tintColor="#FFFFFF"
              shadowIntensity="light"
              forceBorder
              borderColor="rgba(0, 0, 0, 0.12)"
              height={56}
              borderRadius={16}
            />

            <LiquidGlassButton
              title="Save"
              onPress={handleSave}
              style={styles.saveButton}
              textStyle={styles.saveButtonText}
              tintColor={theme.colors.secondary}
              shadowIntensity="medium"
              forceBorder
              borderColor="rgba(255, 255, 255, 0.35)"
              height={56}
              borderRadius={16}
            />
          </View>
        )}
      </View>
    </CustomBottomSheet>
  );
});

GenericSelectBottomSheet.displayName = 'GenericSelectBottomSheet';

const createStyles = (theme: any, maxListHeight: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: theme.spacing['5'],
      backgroundColor: theme.colors.background,
    },
    searchContainer: {
      marginBottom: theme.spacing['4'],
    },
    searchInputContainer: {
      marginBottom: 0,
    },
    searchIconImage: {
      width: theme.spacing['5'],
      height: theme.spacing['5'],
      tintColor: theme.colors.textSecondary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.spacing['10'],
    },
    emptyText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    listWrapper: {
      maxHeight: maxListHeight,
      marginBottom: theme.spacing['2'],
    },
    listContent: {
      paddingBottom: theme.spacing['2'],
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: theme.spacing['3'],
      borderRadius: theme.borderRadius.base,
      marginBottom: theme.spacing['1'],
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    itemSelected: {
      backgroundColor: theme.colors.surface,
    },
    itemLabel: {
      flex: 1,
      ...theme.typography.body,
      color: theme.colors.text,
    },
    checkmark: {
      width: theme.spacing['5'],
      height: theme.spacing['5'],
      borderRadius: theme.spacing['5'] / 2,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkmarkText: {
      color: theme.colors.white,
      fontSize: theme.spacing['3'],
      fontWeight: 'bold',
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: theme.spacing['3'],
      paddingVertical: theme.spacing['4'],
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.white,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: theme.colors.white,
    },
    cancelButtonText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.text,
    },
    saveButton: {
      flex: 1,
      backgroundColor: theme.colors.secondary,
    },
    saveButtonText: {
      color: theme.colors.white,
      ...theme.typography.paragraphBold,
    },
    bottomSheetBackground: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
    },
    bottomSheetHandle: {
      backgroundColor: theme.colors.black,
      width: 80,
      height: 6,
      opacity: 0.2,
    },
    touchableItem: {
      flex: 1,
    },
  });
