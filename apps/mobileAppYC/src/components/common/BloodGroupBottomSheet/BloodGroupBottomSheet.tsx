// src/components/common/BloodGroupBottomSheet/BloodGroupBottomSheet.tsx
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
import LiquidGlassButton from '../LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '../../../hooks';
import {Images} from '../../../assets/images';
import type {CompanionCategory} from '@/features/companion/types';

export interface BloodGroupBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface BloodGroupBottomSheetProps {
  selectedBloodGroup: string | null;
  category: CompanionCategory | null;
  onSave: (bloodGroup: string | null) => void;
}

// Blood group options by category
const BLOOD_GROUPS: Record<CompanionCategory, string[]> = {
  cat: ['A', 'B', 'AB', 'Unknown'],
  dog: [
    'DEA 1.1 Positive',
    'DEA 1.1 Negative',
    'DEA 1.2 Positive',
    'DEA 1.2 Negative',
    'DEA 3 Positive',
    'DEA 3 Negative',
    'DEA 4 Positive',
    'DEA 4 Negative',
    'DEA 5 Positive',
    'DEA 5 Negative',
    'DEA 7 Positive',
    'DEA 7 Negative',
    'Universal Donor',
    'Unknown',
  ],
  horse: [
    'Aa',
    'Ca',
    'Da',
    'Ka',
    'Pa',
    'Qa',
    'Ua',
    'Universal Donor',
    'Unknown',
  ],
};

export const BloodGroupBottomSheet = forwardRef<
  BloodGroupBottomSheetRef,
  BloodGroupBottomSheetProps
>(({selectedBloodGroup, category, onSave}, ref) => {
  const {theme} = useTheme();
  const bottomSheetRef = useRef<BottomSheetRef>(null);

  const [tempBloodGroup, setTempBloodGroup] = useState<string | null>(selectedBloodGroup);

  const styles = createStyles(theme);

  const bloodGroups = useMemo(() => {
    if (!category) {
      return [];
    }
    return BLOOD_GROUPS[category];
  }, [category]);

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        Please select a companion category first
      </Text>
    </View>
  );

  useImperativeHandle(ref, () => ({
    open: () => {
      setTempBloodGroup(selectedBloodGroup);
      bottomSheetRef.current?.snapToIndex(0);
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
  }));

  const handleSave = () => {
    onSave(tempBloodGroup);
    bottomSheetRef.current?.close();
  };

  const handleCancel = () => {
    setTempBloodGroup(selectedBloodGroup);
    bottomSheetRef.current?.close();
  };

  const renderBloodGroupItem = ({item}: {item: string}) => {
    const isSelected = tempBloodGroup === item;

    return (
      <TouchableOpacity
        style={[
          styles.bloodGroupItem,
          isSelected && styles.bloodGroupItemSelected,
        ]}
        onPress={() => setTempBloodGroup(item)}
        activeOpacity={0.7}>
        <Text style={styles.bloodGroupName}>{item}</Text>
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
      snapPoints={['70%', '85%']}
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
      handleIndicatorStyle={styles.bottomSheetHandle}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Select blood group</Text>
          <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
            <Image
              source={Images.crossIcon}
              style={styles.closeIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        {/* Current Selection */}
        {tempBloodGroup && (
          <View style={styles.currentSelection}>
            <Text style={styles.currentSelectionLabel}>Selected:</Text>
            <Text style={styles.currentSelectionValue}>{tempBloodGroup}</Text>
          </View>
        )}

        {/* Blood Group List */}
        <View style={styles.listWrapper}>
          <FlatList
            data={bloodGroups}
            keyExtractor={item => item}
            renderItem={renderBloodGroupItem}
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

BloodGroupBottomSheet.displayName = 'BloodGroupBottomSheet';

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
      height: 300,
      marginBottom: theme.spacing['2'],
    },
    listContent: {
      paddingBottom: theme.spacing['2'],
    },
    bloodGroupItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: theme.spacing['3'],
      borderRadius: theme.borderRadius.base,
      marginBottom: theme.spacing['1'],
    },
    bloodGroupItemSelected: {
      backgroundColor: theme.colors.surface,
    },
    bloodGroupName: {
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
