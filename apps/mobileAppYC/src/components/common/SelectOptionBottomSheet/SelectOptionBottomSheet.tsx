import React, {forwardRef, useImperativeHandle, useMemo, useRef, useState} from 'react';
import {View, Text, TouchableOpacity, FlatList, Image, StyleSheet} from 'react-native';
import CustomBottomSheet, {type BottomSheetRef} from '@/components/common/BottomSheet/BottomSheet';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

export type Option = {label: string; value: string};

export interface SelectOptionBottomSheetRef {
  open: () => void;
  close: () => void;
}

export type SelectOptionBottomSheetProps = {
  title: string;
  options: Option[];
  selectedValue: string | null | undefined;
  onSelect: (value: string) => void;
};

export const SelectOptionBottomSheet = forwardRef<
  SelectOptionBottomSheetRef,
  SelectOptionBottomSheetProps
>(({title, options, selectedValue, onSelect}, ref) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sheetRef = useRef<BottomSheetRef>(null);
  const [temp, setTemp] = useState<string | null>(selectedValue ?? null);

  useImperativeHandle(ref, () => ({
    open: () => {
      setTemp(selectedValue ?? null);
      sheetRef.current?.snapToIndex(0);
    },
    close: () => sheetRef.current?.close(),
  }));

  const handleSave = () => {
    if (temp != null) onSelect(temp);
    sheetRef.current?.close();
  };

  const handleCancel = () => {
    setTemp(selectedValue ?? null);
    sheetRef.current?.close();
  };

  const renderItem = ({item}: {item: Option}) => {
    const isSelected = temp === item.value;
    return (
      <TouchableOpacity
        style={[styles.optionItem, isSelected && styles.optionSelected]}
        onPress={() => setTemp(item.value)}
        activeOpacity={0.8}
      >
        <Text style={styles.optionLabel}>{item.label}</Text>
        {isSelected ? (
          <View style={styles.checkmark}><Text style={styles.checkText}>✓</Text></View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <CustomBottomSheet
      ref={sheetRef}
      snapPoints={["60%", "90%"]}
      initialIndex={-1}
      enablePanDownToClose
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      enableOverDrag
      enableBackdrop
      backdropOpacity={0.5}
      backdropDisappearsOnIndex={-1}
      backdropPressBehavior="close"
      contentType="view"
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={handleCancel} style={styles.closeBtn}>
            <Image source={Images.crossIcon} style={styles.closeIcon} />
          </TouchableOpacity>
        </View>

        {/* Options */}
        <FlatList
          data={options}
          keyExtractor={(item) => item.value}
          renderItem={renderItem}
          contentContainerStyle={{paddingBottom: 12}}
          showsVerticalScrollIndicator
        />

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </CustomBottomSheet>
  );
});

SelectOptionBottomSheet.displayName = 'SelectOptionBottomSheet';

const createStyles = (theme: any) =>
  StyleSheet.create({
    sheetBg: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
    },
    handle: {
      backgroundColor: theme.colors.black,
      width: 80,
      height: 6,
      opacity: 0.2,
    },
    container: {
      flex: 1,
      paddingHorizontal: theme.spacing[5],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing[4],
      position: 'relative',
    },
    title: {
      ...theme.typography.h3,
      color: theme.colors.text,
    },
    closeBtn: {
      position: 'absolute',
      right: 0,
      padding: theme.spacing[2],
    },
    closeIcon: {width: theme.spacing[6], height: theme.spacing[6]},
    optionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: theme.spacing[3],
      borderRadius: theme.borderRadius.base,
      marginBottom: theme.spacing[1],
    },
    optionSelected: {
      backgroundColor: theme.colors.surface,
    },
    optionLabel: {
      flex: 1,
      ...theme.typography.body,
      color: theme.colors.text,
    },
    checkmark: {
      width: theme.spacing[5],
      height: theme.spacing[5],
      borderRadius: theme.spacing[5] / 2,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkText: {color: theme.colors.white, fontSize: theme.spacing[3], fontWeight: 'bold'},
    footer: {
      flexDirection: 'row',
      gap: theme.spacing[3],
      paddingVertical: theme.spacing[6],
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    cancelBtn: {
      flex: 1,
      backgroundColor: theme.colors.white,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.12)',
      borderRadius: 16,
      alignItems: 'center',
      paddingVertical: 14,
    },
    cancelText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.text,
    },
    saveBtn: {
      flex: 1,
      backgroundColor: theme.colors.secondary,
      borderRadius: 16,
      alignItems: 'center',
      paddingVertical: 14,
    },
    saveText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.white,
    },
  });

export default SelectOptionBottomSheet;