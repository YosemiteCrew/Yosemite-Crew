// src/components/common/BreedBottomSheet/BreedBottomSheet.tsx
import React, {useState, forwardRef, useImperativeHandle, useRef, useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
} from 'react-native';
import CustomBottomSheet from '../BottomSheet/BottomSheet';
import type {BottomSheetRef} from '../BottomSheet/BottomSheet';
import {Input} from '../Input/Input';
import LiquidGlassButton from '../LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '../../../hooks';
import {Images} from '../../../assets/images';
import type {Breed} from '@/features/companion/types';
import type {CompanionCategory} from '@/features/companion/types';

export interface BreedBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface BreedBottomSheetProps {
  breeds: Breed[];
  selectedBreed: Breed | null;
  category: CompanionCategory | null;
  onSave: (breed: Breed | null) => void;
}

export const BreedBottomSheet = forwardRef<
  BreedBottomSheetRef,
  BreedBottomSheetProps
>(({breeds, selectedBreed, category, onSave}, ref) => {
  const {theme} = useTheme();
  const bottomSheetRef = useRef<BottomSheetRef>(null);

  const [tempBreed, setTempBreed] = useState<Breed | null>(selectedBreed);
  const [searchQuery, setSearchQuery] = useState('');

  const styles = createStyles(theme);

  // Filter breeds by category
  const categoryFilteredBreeds = useMemo(() => {
    if (!category) {
      return breeds;
    }

    const categoryMap: Record<CompanionCategory, string> = {
      cat: 'Cat',
      dog: 'Dog',
      horse: 'Horse',
    };

    const categoryName = categoryMap[category];
    return breeds.filter(breed =>
      breed.speciesName.toLowerCase().includes(categoryName.toLowerCase())
    );
  }, [breeds, category]);

  const filteredBreeds = useMemo(() => {
    if (!searchQuery.trim()) {
      return categoryFilteredBreeds;
    }

    const query = searchQuery.toLowerCase();
    return categoryFilteredBreeds.filter(breed =>
      breed.breedName.toLowerCase().includes(query)
    );
  }, [categoryFilteredBreeds, searchQuery]);

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        {searchQuery.trim() ? 'No breeds found' : 'No breeds available'}
      </Text>
    </View>
  );

  useImperativeHandle(ref, () => ({
    open: () => {
      setTempBreed(selectedBreed);
      setSearchQuery('');
      bottomSheetRef.current?.snapToIndex(0);
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
  }));

  const handleSave = () => {
    onSave(tempBreed);
    bottomSheetRef.current?.close();
  };

  const handleCancel = () => {
    setTempBreed(selectedBreed);
    setSearchQuery('');
    bottomSheetRef.current?.close();
  };

  const renderBreedItem = ({item}: {item: Breed}) => {
    const isSelected = tempBreed?.breedId === item.breedId;

    return (
      <TouchableOpacity
        style={[
          styles.breedItem,
          isSelected && styles.breedItemSelected,
        ]}
        onPress={() => setTempBreed(item)}
        activeOpacity={0.7}>
        <Text style={styles.breedName}>{item.breedName}</Text>
        {isSelected && (
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <CustomBottomSheet
      ref={bottomSheetRef}
      snapPoints={['83%', '95%']}
      initialIndex={-1}
      enablePanDownToClose={true}
      enableDynamicSizing={false}
      enableContentPanningGesture={false}
      enableHandlePanningGesture={true}
      enableOverDrag={true}
      enableBackdrop={true}
      backdropOpacity={0.5}
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
        <View style={styles.header}>
          <Text style={styles.title}>Select breed</Text>
          <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
            <Image
              source={Images.crossIcon}
              style={styles.closeIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        {/* Current Selection */}
        {tempBreed && (
          <View style={styles.currentSelection}>
            <Text style={styles.currentSelectionLabel}>Selected:</Text>
            <Text style={styles.currentSelectionValue}>{tempBreed.breedName}</Text>
          </View>
        )}

        {/* Search */}
        <View style={styles.searchContainer}>
          <Input
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search from 200+ breeds"
            icon={
              <Image
                source={Images.searchIcon}
                style={styles.searchIconImage}
              />
            }
            containerStyle={styles.searchInputContainer}
          />
        </View>

        {/* Breed List */}
        <View style={styles.listWrapper}>
          <FlatList
            data={filteredBreeds}
            keyExtractor={item => item.breedId.toString()}
            renderItem={renderBreedItem}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.listContent}
            nestedScrollEnabled={true}
            ListEmptyComponent={renderEmptyList}
          />
        </View>

        {/* Buttons */}
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
      </View>
    </CustomBottomSheet>
  );
});

BreedBottomSheet.displayName = 'BreedBottomSheet';

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: theme.spacing['5'],
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.spacing['4'],
      position: 'relative',
    },
    title: {
      ...theme.typography.h3,
      color: theme.colors.text,
    },
    closeButton: {
      position: 'absolute',
      right: 0,
      padding: theme.spacing['2'],
    },
    closeIcon: {
      width: theme.spacing['6'],
      height: theme.spacing['6'],
    },
    currentSelection: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing['3'],
      paddingHorizontal: theme.spacing['4'],
      backgroundColor: theme.colors.primarySurface,
      borderRadius: theme.borderRadius.lg,
      marginBottom: theme.spacing['4'],
      gap: theme.spacing['2'],
    },
    currentSelectionLabel: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    currentSelectionValue: {
      ...theme.typography.body,
      color: theme.colors.primary,
      fontWeight: '600',
      flex: 1,
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
      flex: 1,
      height: 400,
      marginBottom: theme.spacing['2'],
    },
    listContent: {
      paddingBottom: theme.spacing['2'],
    },
    breedItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: theme.spacing['3'],
      borderRadius: theme.borderRadius.base,
      marginBottom: theme.spacing['1'],
    },
    breedItemSelected: {
      backgroundColor: theme.colors.surface,
    },
    breedName: {
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
      backgroundColor: 'transparent',
    },
    cancelButton: {
      flex: 1,
      backgroundColor: 'transparent',
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
  });
