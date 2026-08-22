import React, {
  useRef,
  useMemo,
  useImperativeHandle,
  useCallback,
  useState,
} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {BottomSheetFlatList} from '@gorhom/bottom-sheet';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import CustomBottomSheet from '@/shared/components/common/BottomSheet/BottomSheet';
import type {BottomSheetRef} from '@/shared/components/common/BottomSheet/BottomSheet';
import {BottomSheetHeader} from '@/shared/components/common/BottomSheetHeader/BottomSheetHeader';
import {useTheme} from '@/hooks';
import {createBottomSheetStyles} from '@/shared/utils/bottomSheetHelpers';
import type {TaskTypeSelection} from '@/features/tasks/types';
import type {
  TaskTypeBottomSheetRef,
  TaskTypeBottomSheetProps,
  TaskTypeOption,
  CategorySection,
  SubcategoryWithChildren,
  SubsubcategoryWithChildren,
} from './types';
import {
  flattenTaskOptions,
  buildCategorySections,
  buildSelectionFromOption,
} from './helpers';
import {taskTypeOptions} from './taskOptions';

type PendingSelection = {
  option: TaskTypeOption;
  ancestors: TaskTypeOption[];
} | null;

// Ionicons name per real task-type leaf, so each chip reads icon + label.
const TASK_TYPE_ICONS: Record<string, string> = {
  'give-medication': 'medkit-outline',
  'take-observational-tool': 'pulse-outline',
  'brushing-hair': 'sparkles-outline',
  'dental-care': 'happy-outline',
  'nail-trimming': 'cut-outline',
  'give-bath': 'water-outline',
  'take-exercise': 'walk-outline',
  'give-training': 'barbell-outline',
  meals: 'nutrition-outline',
  freshwater: 'water-outline',
};

const getOptionIcon = (option: TaskTypeOption): string => {
  if (option.category === 'custom') {
    return 'create-outline';
  }
  if (option.taskType && TASK_TYPE_ICONS[option.taskType]) {
    return TASK_TYPE_ICONS[option.taskType];
  }
  return 'pricetag-outline';
};

const matchesSelection = (
  a: TaskTypeSelection,
  b: TaskTypeSelection,
): boolean =>
  a.category === b.category &&
  a.subcategory === b.subcategory &&
  a.parasitePreventionType === b.parasitePreventionType &&
  a.chronicConditionType === b.chronicConditionType &&
  a.taskType === b.taskType &&
  a.label === b.label;

const findPendingForSelection = (
  selection: TaskTypeSelection | null | undefined,
  flattened: Array<{option: TaskTypeOption; ancestors: TaskTypeOption[]}>,
): PendingSelection => {
  if (!selection) {
    return null;
  }
  for (const entry of flattened) {
    if (entry.option.children && entry.option.children.length > 0) {
      continue;
    }
    if (
      matchesSelection(
        buildSelectionFromOption(entry.option, entry.ancestors),
        selection,
      )
    ) {
      return entry;
    }
  }
  return null;
};

export const TaskTypeBottomSheet = ({
  selectedTaskType,
  onSelect,
  onSheetChange,
  ref,
}: TaskTypeBottomSheetProps & {ref?: React.Ref<TaskTypeBottomSheetRef>}) => {
  const {theme} = useTheme();
  const {bottom: bottomSafeAreaInset} = useSafeAreaInsets();
  const listBottomInset = Math.max(
    theme.spacing['20'],
    bottomSafeAreaInset + theme.spacing['20'],
  );
  const scrollIndicatorInsets = useMemo(
    () => ({bottom: listBottomInset}),
    [listBottomInset],
  );
  const styles = useMemo(
    () => createStyles(theme, listBottomInset),
    [theme, listBottomInset],
  );
  const bottomSheetRef = useRef<BottomSheetRef>(null);
  const [isSheetVisible, setIsSheetVisible] = useState(false);

  // Flatten all task options recursively
  const flattenedOptions = useMemo(() => {
    const result = [];
    for (const option of taskTypeOptions) {
      result.push(...flattenTaskOptions([option]));
    }
    return result;
  }, []);

  // Build category sections with proper hierarchy
  const categorySections = useMemo(() => {
    return buildCategorySections(flattenedOptions);
  }, [flattenedOptions]);

  // Custom (single) chips render last, mirroring the sheet's group order.
  const orderedSections = useMemo(() => {
    const groups = categorySections.filter(
      section => section.type !== 'single',
    );
    const singles = categorySections.filter(
      section => section.type === 'single',
    );
    return [...groups, ...singles];
  }, [categorySections]);

  // Highlight the chip that matches the incoming selection.
  const initialPending = useMemo(
    () => findPendingForSelection(selectedTaskType, flattenedOptions),
    [selectedTaskType, flattenedOptions],
  );
  const [pending, setPending] = useState<PendingSelection>(initialPending);

  // Expose ref methods
  useImperativeHandle(ref, () => ({
    open: () => {
      setPending(initialPending);
      setIsSheetVisible(true);
      bottomSheetRef.current?.expand();
    },
    close: () => {
      setIsSheetVisible(false);
      bottomSheetRef.current?.close();
    },
  }));

  // Select a task type and close the sheet immediately.
  const handlePillPress = useCallback(
    (option: TaskTypeOption, ancestors: TaskTypeOption[]) => {
      setPending({option, ancestors});
      const selection = buildSelectionFromOption(option, ancestors);
      onSelect(selection);
      setIsSheetVisible(false);
      bottomSheetRef.current?.close();
    },
    [onSelect],
  );

  // Render a single pill button
  const renderPillButton = useCallback(
    (child: {option: TaskTypeOption; ancestors: TaskTypeOption[]}) => {
      const isSelected = pending?.option.id === child.option.id;
      return (
        <PressableOpacity
          key={child.option.id}
          style={[styles.pillButton, isSelected && styles.pillButtonSelected]}
          onPress={() => handlePillPress(child.option, child.ancestors)}
          accessibilityRole="radio"
          accessibilityState={{selected: isSelected}}
          accessibilityLabel={child.option.label}>
          <Ionicons
            name={getOptionIcon(child.option)}
            size={14}
            color={isSelected ? theme.colors.white : theme.colors.inkBody}
          />
          <Text
            style={[
              styles.pillButtonText,
              isSelected && styles.pillButtonTextSelected,
            ]}>
            {child.option.label}
          </Text>
        </PressableOpacity>
      );
    },
    [
      handlePillPress,
      pending,
      styles.pillButton,
      styles.pillButtonSelected,
      styles.pillButtonText,
      styles.pillButtonTextSelected,
      theme.colors.white,
      theme.colors.inkBody,
    ],
  );

  // Render subsubcategory group with pills
  const renderSubsubcategory = useCallback(
    (subsubcat: SubsubcategoryWithChildren) => (
      <View
        key={subsubcat.subsubcategory.id}
        style={styles.subsubcategoryGroup}>
        <Text style={styles.subsubcategoryHeader}>
          {subsubcat.subsubcategory.label}
        </Text>
        <View style={styles.pillsContainer}>
          {subsubcat.children.map(renderPillButton)}
        </View>
      </View>
    ),
    [
      renderPillButton,
      styles.subsubcategoryGroup,
      styles.subsubcategoryHeader,
      styles.pillsContainer,
    ],
  );

  // Render subcategory group (either with subsubcategories or direct children)
  const renderSubcategory = useCallback(
    (subcat: SubcategoryWithChildren, categoryId: string) => {
      const hasSubsubcategories =
        subcat.subsubcategories && subcat.subsubcategories.length > 0;
      const showSubcategoryHeader = categoryId !== subcat.subcategory.id;

      return (
        <View key={subcat.subcategory.id} style={styles.subcategoryGroup}>
          {showSubcategoryHeader && (
            <Text style={styles.subcategoryHeader}>
              {subcat.subcategory.label}
            </Text>
          )}

          {hasSubsubcategories ? (
            <View>{subcat.subsubcategories!.map(renderSubsubcategory)}</View>
          ) : (
            <View style={styles.pillsContainer}>
              {subcat.children?.map(renderPillButton)}
            </View>
          )}
        </View>
      );
    },
    [
      renderPillButton,
      renderSubsubcategory,
      styles.subcategoryGroup,
      styles.subcategoryHeader,
      styles.pillsContainer,
    ],
  );

  // Render a single category section
  const renderCategorySection = useCallback(
    (section: CategorySection) => {
      // Custom category - single pill at top level without category container/header
      if (section.type === 'single') {
        const isSelected = pending?.option.id === section.category.id;
        return (
          <View key={section.category.id} style={styles.customPillWrapper}>
            <PressableOpacity
              style={[
                styles.pillButton,
                isSelected && styles.pillButtonSelected,
              ]}
              onPress={() => handlePillPress(section.category, [])}
              accessibilityRole="radio"
              accessibilityState={{selected: isSelected}}
              accessibilityLabel={section.category.label}>
              <Ionicons
                name={getOptionIcon(section.category)}
                size={14}
                color={isSelected ? theme.colors.white : theme.colors.inkBody}
              />
              <Text
                style={[
                  styles.pillButtonText,
                  isSelected && styles.pillButtonTextSelected,
                ]}>
                {section.category.label}
              </Text>
            </PressableOpacity>
          </View>
        );
      }

      // Regular category with subcategories or direct pills
      return (
        <View key={section.category.id} style={styles.categorySection}>
          <Text style={styles.categoryHeader}>{section.category.label}</Text>
          {section.subcategories?.map(subcat =>
            renderSubcategory(subcat, section.category.id),
          )}
        </View>
      );
    },
    [
      handlePillPress,
      pending,
      renderSubcategory,
      styles.customPillWrapper,
      styles.pillButton,
      styles.pillButtonSelected,
      styles.pillButtonText,
      styles.pillButtonTextSelected,
      styles.categorySection,
      styles.categoryHeader,
      theme.colors.white,
      theme.colors.inkBody,
    ],
  );

  // Stable renderItem for FlatList; satisfies react-doctor/rn-no-inline-flatlist-renderitem.
  const renderItem = useCallback(
    ({item}: {item: CategorySection}) => renderCategorySection(item),
    [renderCategorySection],
  );

  const handleClose = () => {
    setIsSheetVisible(false);
    bottomSheetRef.current?.close();
  };

  const handleSheetChange = useCallback(
    (index: number) => {
      setIsSheetVisible(index !== -1);
      onSheetChange?.(index);
    },
    [onSheetChange],
  );

  return (
    <CustomBottomSheet
      ref={bottomSheetRef}
      snapPoints={['75%', '85%']}
      initialIndex={-1}
      behavior={{
        panDownToClose: true,
        dynamicSizing: false,
        contentPanningGesture: false,
        handlePanningGesture: true,
        overDrag: false,
        backdrop: isSheetVisible,
      }}
      backdropOpacity={0.5}
      backdropDisappearsOnIndex={-1}
      contentType="view"
      contentStyle={styles.sheetContent}
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.bottomSheetHandle}
      onChange={handleSheetChange}>
      <View style={styles.container}>
        <BottomSheetHeader
          title="Select task type"
          onClose={handleClose}
          theme={theme}
        />

        <View style={styles.listWrapper}>
          <BottomSheetFlatList
            testID="task-type-list"
            style={styles.list}
            data={orderedSections}
            keyExtractor={(item: CategorySection) => item.category.id}
            renderItem={renderItem}
            extraData={pending?.option.id}
            contentContainerStyle={styles.scrollContent}
            scrollIndicatorInsets={scrollIndicatorInsets}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      </View>
    </CustomBottomSheet>
  );
};

TaskTypeBottomSheet.displayName = 'TaskTypeBottomSheet';

const createStyles = (theme: any, listBottomInset: number) =>
  StyleSheet.create({
    ...createBottomSheetStyles(theme),
    bottomSheetHandle: {
      backgroundColor: theme.colors.divider,
      width: theme.spacing['10'],
      height: 4.5,
      borderRadius: theme.borderRadius.full,
    },
    // BottomSheetView only sets top/left/right by default, so it can size to
    // content height instead of filling the sheet. bottom: 0 makes it stretch
    // so the flex chain below (container -> listWrapper) can bound the list.
    sheetContent: {
      bottom: 0,
    },
    container: {
      flex: 1,
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['2.5'],
      paddingBottom: theme.spacing['6'],
      backgroundColor: theme.colors.background,
    },
    listWrapper: {
      flex: 1,
    },
    list: {
      flex: 1,
    },
    // Extra bottom clearance so the last section (Dietary + Custom) can be
    // scrolled fully clear of the sheet's rounded bottom edge and safe area.
    // padding on the outer container doesn't help since it sits outside the
    // FlatList's own scrollable frame.
    scrollContent: {
      paddingTop: theme.spacing['1'],
      paddingBottom: listBottomInset,
      gap: theme.spacing['4'],
    },
    customPillWrapper: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing['2'],
    },
    categorySection: {
      gap: theme.spacing['2.5'],
    },
    categoryHeader: {
      ...theme.typography.eyebrow,
      color: theme.colors.inkMuted,
    },
    subcategoryGroup: {
      gap: theme.spacing['2'],
      marginBottom: theme.spacing['1'],
    },
    subcategoryHeader: {
      ...theme.typography.labelXs,
      color: theme.colors.inkMuted,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    subsubcategoryGroup: {
      gap: theme.spacing['2'],
      marginLeft: theme.spacing['2'],
      marginBottom: theme.spacing['1'],
    },
    subsubcategoryHeader: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.inkMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    pillsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing['2'],
      alignItems: 'flex-start',
    },
    pillButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['1.25'],
      paddingVertical: theme.spacing['2.5'],
      paddingHorizontal: theme.spacing['3.5'],
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      borderRadius: theme.borderRadius.pill,
      backgroundColor: theme.colors.screen2,
      alignSelf: 'flex-start',
    },
    pillButtonSelected: {
      backgroundColor: theme.colors.blue,
      borderColor: theme.colors.blue,
      boxShadow: `0px 6px 16px ${theme.colors.navActiveBg}`,
    },
    pillButtonText: {
      ...theme.typography.labelSmall,
      color: theme.colors.inkBody,
    },
    pillButtonTextSelected: {
      color: theme.colors.white,
      fontWeight: '600',
    },
  });

export default TaskTypeBottomSheet;
