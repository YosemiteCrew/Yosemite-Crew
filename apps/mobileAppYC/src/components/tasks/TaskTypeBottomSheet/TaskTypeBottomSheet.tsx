import React, {forwardRef, useRef, useMemo, useImperativeHandle, useCallback} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, FlatList} from 'react-native';
import CustomBottomSheet from '@/components/common/BottomSheet/BottomSheet';
import type {BottomSheetRef} from '@/components/common/BottomSheet/BottomSheet';
import {BottomSheetHeader} from '@/components/common/BottomSheetHeader/BottomSheetHeader';
import {useTheme} from '@/hooks';
import {createBottomSheetStyles} from '@/utils/bottomSheetHelpers';
import type {
  TaskTypeBottomSheetRef,
  TaskTypeBottomSheetProps,
  TaskTypeOption,
  CategorySection,
  SubcategoryWithChildren,
  SubsubcategoryWithChildren,
} from './types';
import {flattenTaskOptions, buildCategorySections, buildSelectionFromOption} from './helpers';
import {taskTypeOptions} from './taskOptions';

export const TaskTypeBottomSheet = forwardRef<TaskTypeBottomSheetRef, TaskTypeBottomSheetProps>(
  ({onSelect}, ref) => {
    const {theme} = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const bottomSheetRef = useRef<BottomSheetRef>(null);

    // Expose ref methods
    useImperativeHandle(ref, () => ({
      open: () => bottomSheetRef.current?.expand(),
      close: () => bottomSheetRef.current?.close(),
    }));

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

    // Handler for selecting a task type
    const handleTaskSelect = useCallback((option: TaskTypeOption, ancestors: TaskTypeOption[]) => {
      const selection = buildSelectionFromOption(option, ancestors);
      onSelect(selection);
      bottomSheetRef.current?.close();
    }, [onSelect]);

    // Render a single pill button
    const renderPillButton = useCallback((child: {option: TaskTypeOption; ancestors: TaskTypeOption[]}) => (
      <TouchableOpacity
        key={child.option.id}
        style={styles.pillButton}
        onPress={() => handleTaskSelect(child.option, child.ancestors)}>
        <Text style={styles.pillButtonText}>{child.option.label}</Text>
      </TouchableOpacity>
    ), [handleTaskSelect, styles.pillButton, styles.pillButtonText]);

    // Render subsubcategory group with pills
    const renderSubsubcategory = useCallback((subsubcat: SubsubcategoryWithChildren) => (
      <View key={subsubcat.subsubcategory.id} style={styles.subsubcategoryGroup}>
        <Text style={styles.subsubcategoryHeader}>{subsubcat.subsubcategory.label}</Text>
        <View style={styles.pillsContainer}>
          {subsubcat.children.map(renderPillButton)}
        </View>
      </View>
    ), [renderPillButton, styles.subsubcategoryGroup, styles.subsubcategoryHeader, styles.pillsContainer]);

    // Render subcategory group (either with subsubcategories or direct children)
    const renderSubcategory = useCallback((subcat: SubcategoryWithChildren, categoryId: string) => {
      const hasSubsubcategories = subcat.subsubcategories && subcat.subsubcategories.length > 0;
      const showSubcategoryHeader = categoryId !== subcat.subcategory.id;

      return (
        <View key={subcat.subcategory.id} style={styles.subcategoryGroup}>
          {showSubcategoryHeader && (
            <Text style={styles.subcategoryHeader}>{subcat.subcategory.label}</Text>
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
    }, [renderPillButton, renderSubsubcategory, styles.subcategoryGroup, styles.subcategoryHeader, styles.pillsContainer]);

    // Render a single category section
    const renderCategorySection = useCallback((section: CategorySection) => {
      // Custom category - single pill at top level without category container/header
      if (section.type === 'single') {
        return (
          <View key={section.category.id} style={styles.customPillWrapper}>
            <TouchableOpacity
              style={styles.pillButton}
              onPress={() => handleTaskSelect(section.category, [])}>
              <Text style={styles.pillButtonText}>{section.category.label}</Text>
            </TouchableOpacity>
          </View>
        );
      }

      // Regular category with subcategories or direct pills
      return (
        <View key={section.category.id} style={styles.categorySection}>
          <Text style={styles.categoryHeader}>{section.category.label}</Text>
          {section.subcategories?.map(subcat => renderSubcategory(subcat, section.category.id))}
        </View>
      );
    }, [handleTaskSelect, renderSubcategory, styles.customPillWrapper, styles.pillButton, styles.pillButtonText, styles.categorySection, styles.categoryHeader]);

    const handleClose = () => {
      bottomSheetRef.current?.close();
    };

    return (
      <CustomBottomSheet
        ref={bottomSheetRef}
        snapPoints={['50%', '80%']}
        initialIndex={-1}
        enablePanDownToClose
        enableDynamicSizing={false}
        enableContentPanningGesture={false}
        enableHandlePanningGesture
        enableOverDrag={false}
        enableBackdrop
        backdropOpacity={0.5}
        backdropDisappearsOnIndex={-1}
        contentType="view"
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetHandle}>
        <View style={styles.container}>
          <BottomSheetHeader
            title="Select Task Type"
            onClose={handleClose}
            theme={theme}
          />

          <View style={styles.listWrapper}>
            <FlatList
              data={categorySections}
              keyExtractor={(item) => item.category.id}
              renderItem={({item}) => renderCategorySection(item)}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            />
          </View>
        </View>
      </CustomBottomSheet>
    );
  },
);

TaskTypeBottomSheet.displayName = 'TaskTypeBottomSheet';

const createStyles = (theme: any) =>
  StyleSheet.create({
    ...createBottomSheetStyles(theme),
    container: {
      flex: 1,
      paddingHorizontal: theme.spacing['5'],
      backgroundColor: theme.colors.background,
    },
    listWrapper: {
      maxHeight: 600,
      marginBottom: theme.spacing['3'],
    },
    scrollContent: {
      paddingVertical: theme.spacing['1'],
      gap: theme.spacing['3'],
      paddingHorizontal: theme.spacing['2'],
    },
    customPillWrapper: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing['2'],
      marginBottom: theme.spacing['2'],
    },
    categorySection: {
      paddingHorizontal: theme.spacing['2'],
      paddingVertical: theme.spacing['3'],
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#EAEAEA',
      backgroundColor: '#FFFEFE',
    },
    categoryHeader: {
      ...theme.typography.bodySmall,
      color: theme.colors.text,
      fontWeight: '700',
      paddingHorizontal: theme.spacing['1'],
      marginBottom: theme.spacing['2'],
      fontSize: 14,
    },
    subcategoryGroup: {
      marginBottom: theme.spacing['3'],
    },
    subcategoryHeader: {
      ...theme.typography.labelSmall,
      color: theme.colors.textSecondary,
      fontWeight: '600',
      fontSize: 12,
      paddingHorizontal: theme.spacing['1'],
      marginBottom: theme.spacing['1'],
    },
    subsubcategoryGroup: {
      marginBottom: theme.spacing['2'],
      marginLeft: theme.spacing['2'],
    },
    subsubcategoryHeader: {
      ...theme.typography.labelSmall,
      color: theme.colors.textSecondary,
      fontWeight: '600',
      fontSize: 11,
      paddingHorizontal: theme.spacing['1'],
      marginBottom: theme.spacing['1'],
    },
    pillsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing['2'],
      alignItems: 'flex-start',
    },
    pillButton: {
      paddingVertical: 8,
      paddingHorizontal: theme.spacing['3'],
      borderWidth: 1,
      borderColor: '#302F2E',
      borderRadius: 12,
      backgroundColor: '#FFFEFE',
      alignSelf: 'flex-start',
    },
    pillButtonText: {
      ...theme.typography.labelSmall,
      color: theme.colors.text,
      fontWeight: '600',
      fontSize: 13,
    },
  });

export default TaskTypeBottomSheet;
