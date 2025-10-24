import React, {forwardRef, useRef, useMemo, useImperativeHandle} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, FlatList, Image} from 'react-native';
import CustomBottomSheet from '@/components/common/BottomSheet/BottomSheet';
import type {BottomSheetRef} from '@/components/common/BottomSheet/BottomSheet';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {
  createBottomSheetStyles,
} from '@/utils/bottomSheetHelpers';
import type {
  TaskCategory,
  HealthSubcategory,
  ParasitePreventionType,
  ChronicConditionType,
  TaskTypeSelection,
} from '@/features/tasks/types';

export interface TaskTypeBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface TaskTypeBottomSheetProps {
  selectedTaskType?: TaskTypeSelection | null;
  onSelect: (selection: TaskTypeSelection) => void;
  companionType?: 'cat' | 'dog' | 'horse';
}

interface TaskTypeOption {
  id: string;
  label: string;
  category?: TaskCategory;
  subcategory?: HealthSubcategory;
  parasitePreventionType?: ParasitePreventionType;
  chronicConditionType?: ChronicConditionType;
  taskType?: string;
  children?: TaskTypeOption[];
}

interface SubsubcategoryWithChildren {
  subsubcategory: TaskTypeOption;
  children: Array<{option: TaskTypeOption; ancestors: TaskTypeOption[]}>;
}

interface SubcategoryWithChildren {
  subcategory: TaskTypeOption;
  subsubcategories?: SubsubcategoryWithChildren[];
  children?: Array<{option: TaskTypeOption; ancestors: TaskTypeOption[]}>;
}

interface CategorySection {
  type: 'single' | 'category'; // single for Custom, category for others
  category: TaskTypeOption;
  subcategories?: SubcategoryWithChildren[];
}

export const TaskTypeBottomSheet = forwardRef<TaskTypeBottomSheetRef, TaskTypeBottomSheetProps>(
  ({onSelect, companionType: _companionType = 'dog'}, ref) => {
    const {theme} = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const bottomSheetRef = useRef<BottomSheetRef>(null);

    // Expose ref methods
    useImperativeHandle(ref, () => ({
      open: () => bottomSheetRef.current?.expand(),
      close: () => bottomSheetRef.current?.close(),
    }));

    const taskTypeOptions: TaskTypeOption[] = useMemo(() => [
      {
        id: 'custom',
        label: 'Custom',
        category: 'custom',
      },
      {
        id: 'health',
        label: 'Health',
        category: 'health',
        children: [
          {
            id: 'health-vaccination',
            label: 'Vaccination',
            subcategory: 'vaccination',
            children: [
              {
                id: 'health-vaccination-give-medication',
                label: 'Give medication',
                taskType: 'give-medication',
              },
            ],
          },
          {
            id: 'health-parasite',
            label: 'Parasite Prevention',
            subcategory: 'parasite-prevention',
            children: [
              {
                id: 'deworming',
                label: 'Deworming',
                parasitePreventionType: 'deworming',
                children: [
                  {
                    id: 'deworming-medication',
                    label: 'Give medication',
                    taskType: 'give-medication',
                  },
                  {
                    id: 'deworming-tool',
                    label: 'Take observational tool',
                    taskType: 'take-observational-tool',
                  },
                ],
              },
              {
                id: 'flea-tick',
                label: 'Flea and tick prevention',
                parasitePreventionType: 'flea-tick-prevention',
                children: [
                  {
                    id: 'flea-tick-medication',
                    label: 'Give medication',
                    taskType: 'give-medication',
                  },
                  {
                    id: 'flea-tick-tool',
                    label: 'Take observational tool',
                    taskType: 'take-observational-tool',
                  },
                ],
              },
            ],
          },
          {
            id: 'health-chronic',
            label: 'Chronic conditions',
            subcategory: 'chronic-conditions',
            children: [
              {
                id: 'pain',
                label: 'Pain',
                chronicConditionType: 'pain',
                children: [
                  {
                    id: 'pain-medication',
                    label: 'Give medication',
                    taskType: 'give-medication',
                  },
                  {
                    id: 'pain-tool',
                    label: 'Take observational tool',
                    taskType: 'take-observational-tool',
                  },
                ],
              },
              {
                id: 'diabetes',
                label: 'Diabetes',
                chronicConditionType: 'diabetes',
                children: [
                  {
                    id: 'diabetes-medication',
                    label: 'Give medication',
                    taskType: 'give-medication',
                  },
                  {
                    id: 'diabetes-tool',
                    label: 'Take observational tool',
                    taskType: 'take-observational-tool',
                  },
                ],
              },
              {
                id: 'epilepsy',
                label: 'Epilepsy',
                chronicConditionType: 'epilepsy',
                children: [
                  {
                    id: 'epilepsy-medication',
                    label: 'Give medication',
                    taskType: 'give-medication',
                  },
                  {
                    id: 'epilepsy-tool',
                    label: 'Take observational tool',
                    taskType: 'take-observational-tool',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'hygiene',
        label: 'Hygiene maintenance',
        category: 'hygiene',
        children: [
          {
            id: 'brushing-hair',
            label: 'Brushing hair',
            taskType: 'brushing-hair',
          },
          {
            id: 'dental-care',
            label: 'Dental care',
            taskType: 'dental-care',
          },
          {
            id: 'nail-trimming',
            label: 'Nail trimming',
            taskType: 'nail-trimming',
          },
          {
            id: 'give-bath',
            label: 'Give bath',
            taskType: 'give-bath',
          },
          {
            id: 'take-exercise',
            label: 'Take for exercise',
            taskType: 'take-exercise',
          },
          {
            id: 'give-training',
            label: 'Give training',
            taskType: 'give-training',
          },
        ],
      },
      {
        id: 'dietary',
        label: 'Dietary plan',
        category: 'dietary',
        children: [
          {
            id: 'meals',
            label: 'Meals',
            taskType: 'meals',
          },
          {
            id: 'freshwater',
            label: 'Freshwater',
            taskType: 'freshwater',
          },
        ],
      },
    ], []);

    // Helper functions
    const isLeafNode = (option: TaskTypeOption) => !option.children || option.children.length === 0;
    const isCategory = (option: TaskTypeOption) => option.children && option.children.length > 0;

    // Flatten all task options recursively
    const flattenTaskOptions = useMemo(() => {
      const flatten = (options: TaskTypeOption[], ancestors: TaskTypeOption[] = []) => {
        const result: Array<{option: TaskTypeOption; ancestors: TaskTypeOption[]}> = [];

        options.forEach(option => {
          if (option.children && option.children.length > 0) {
            result.push({option, ancestors});
            result.push(...flatten(option.children, [...ancestors, option]));
          } else {
            result.push({option, ancestors});
          }
        });

        return result;
      };

      return flatten(taskTypeOptions);
    }, [taskTypeOptions]);

    // Build category sections with proper hierarchy
    const categorySections = useMemo(() => {
      const sections: CategorySection[] = [];

      flattenTaskOptions.forEach(item => {
        // Handle Custom separately (it doesn't have children, so it won't be detected as category)
        if (item.option.id === 'custom' && item.ancestors.length === 0) {
          sections.push({
            type: 'single',
            category: item.option,
          });
        } else if (isCategory(item.option) && item.ancestors.length === 0) {
          // For other categories, group by their direct children (subcategories or leaf nodes)
          const directChildren = flattenTaskOptions.filter(
            child =>
              child.ancestors.length > 0 &&
              child.ancestors[child.ancestors.length - 1]?.id === item.option.id
          );

          // Check if direct children are categories (have their own children)
          const hasSubcategories = directChildren.some(child => isCategory(child.option));

          if (hasSubcategories) {
            // For Health: group by subcategories with potential sub-subcategories
            const subcategories: SubcategoryWithChildren[] = [];

            directChildren.forEach(subcat => {
              if (isCategory(subcat.option)) {
                // Get direct children of subcategory
                const subcatDirectChildren = flattenTaskOptions.filter(
                  child =>
                    child.ancestors.length > 0 &&
                    child.ancestors[child.ancestors.length - 1]?.id === subcat.option.id
                );

                // Check if these children are also categories (3rd level)
                const hasSubSubcategories = subcatDirectChildren.some(child => isCategory(child.option));

                if (hasSubSubcategories) {
                  // 3rd level: For Parasite Prevention and Chronic Conditions
                  const subsubcategories: SubsubcategoryWithChildren[] = [];

                  subcatDirectChildren.forEach(subsubcat => {
                    if (isCategory(subsubcat.option)) {
                      const subsubcatLeaves = flattenTaskOptions.filter(
                        leaf =>
                          leaf.ancestors.length > 0 &&
                          leaf.ancestors.some(anc => anc.id === subsubcat.option.id) &&
                          isLeafNode(leaf.option)
                      );

                      if (subsubcatLeaves.length > 0) {
                        subsubcategories.push({
                          subsubcategory: subsubcat.option,
                          children: subsubcatLeaves,
                        });
                      }
                    }
                  });

                  if (subsubcategories.length > 0) {
                    subcategories.push({
                      subcategory: subcat.option,
                      subsubcategories,
                    });
                  }
                } else {
                  // 2nd level: Direct leaves (like Vaccination)
                  const subcatLeaves = flattenTaskOptions.filter(
                    leaf =>
                      leaf.ancestors.length > 0 &&
                      leaf.ancestors.some(anc => anc.id === subcat.option.id) &&
                      isLeafNode(leaf.option)
                  );

                  if (subcatLeaves.length > 0) {
                    subcategories.push({
                      subcategory: subcat.option,
                      children: subcatLeaves,
                    });
                  }
                }
              }
            });

            if (subcategories.length > 0) {
              sections.push({
                type: 'category',
                category: item.option,
                subcategories,
              });
            }
          } else {
            // For Hygiene/Dietary: direct leaf children
            const leaves = flattenTaskOptions.filter(
              leaf =>
                leaf.ancestors.length > 0 &&
                leaf.ancestors[leaf.ancestors.length - 1]?.id === item.option.id &&
                isLeafNode(leaf.option)
            );

            if (leaves.length > 0) {
              sections.push({
                type: 'category',
                category: item.option,
                subcategories: [
                  {
                    subcategory: item.option,
                    children: leaves,
                  },
                ],
              });
            }
          }
        }
      });

      return sections;
    }, [flattenTaskOptions]);

    const buildSelectionFromOption = (
      option: TaskTypeOption,
      ancestors: TaskTypeOption[],
    ): TaskTypeSelection => {
      let category: TaskCategory = 'custom';
      let subcategory: HealthSubcategory | undefined;
      let parasitePreventionType: ParasitePreventionType | undefined;
      let chronicConditionType: ChronicConditionType | undefined;
      let taskType: string | undefined;

      if (option.category) {
        category = option.category;
      } else {
        for (const ancestor of ancestors) {
          if (ancestor.category) {
            category = ancestor.category;
            break;
          }
        }
      }

      if (option.subcategory) {
        subcategory = option.subcategory;
      } else {
        for (const ancestor of ancestors) {
          if (ancestor.subcategory) {
            subcategory = ancestor.subcategory;
            break;
          }
        }
      }

      if (option.parasitePreventionType) {
        parasitePreventionType = option.parasitePreventionType;
      } else {
        for (const ancestor of ancestors) {
          if (ancestor.parasitePreventionType) {
            parasitePreventionType = ancestor.parasitePreventionType;
            break;
          }
        }
      }

      if (option.chronicConditionType) {
        chronicConditionType = option.chronicConditionType;
      } else {
        for (const ancestor of ancestors) {
          if (ancestor.chronicConditionType) {
            chronicConditionType = ancestor.chronicConditionType;
            break;
          }
        }
      }

      if (option.taskType) {
        taskType = option.taskType;
      }

      return {
        category,
        subcategory,
        parasitePreventionType,
        chronicConditionType,
        taskType,
        label: option.label,
      };
    };

    const renderCategorySection = (section: CategorySection) => {
      // Custom category - single pill at top level without category container/header
      if (section.type === 'single') {
        return (
          <View key={section.category.id} style={styles.customPillWrapper}>
            <TouchableOpacity
              style={styles.pillButton}
              onPress={() => {
                const selection = buildSelectionFromOption(section.category, []);
                onSelect(selection);
                bottomSheetRef.current?.close();
              }}>
              <Text style={styles.pillButtonText}>{section.category.label}</Text>
            </TouchableOpacity>
          </View>
        );
      }

      // Regular category with subcategories or direct pills
      return (
        <View key={section.category.id} style={styles.categorySection}>
          <Text style={styles.categoryHeader}>{section.category.label}</Text>

          {section.subcategories?.map(subcat => (
            <View key={subcat.subcategory.id} style={styles.subcategoryGroup}>
              {/* Only show subcategory header if it's different from category (for Health) */}
              {section.category.id !== subcat.subcategory.id && (
                <Text style={styles.subcategoryHeader}>{subcat.subcategory.label}</Text>
              )}

              {/* 3-level hierarchy: subsubcategories */}
              {subcat.subsubcategories && subcat.subsubcategories.length > 0 ? (
                <View>
                  {subcat.subsubcategories.map(subsubcat => (
                    <View key={subsubcat.subsubcategory.id} style={styles.subsubcategoryGroup}>
                      <Text style={styles.subsubcategoryHeader}>{subsubcat.subsubcategory.label}</Text>
                      <View style={styles.pillsContainer}>
                        {subsubcat.children.map(child => (
                          <TouchableOpacity
                            key={child.option.id}
                            style={styles.pillButton}
                            onPress={() => {
                              const selection = buildSelectionFromOption(child.option, child.ancestors);
                              onSelect(selection);
                              bottomSheetRef.current?.close();
                            }}>
                            <Text style={styles.pillButtonText}>{child.option.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                /* 2-level hierarchy: direct children */
                <View style={styles.pillsContainer}>
                  {subcat.children?.map(child => (
                    <TouchableOpacity
                      key={child.option.id}
                      style={styles.pillButton}
                      onPress={() => {
                        const selection = buildSelectionFromOption(child.option, child.ancestors);
                        onSelect(selection);
                        bottomSheetRef.current?.close();
                      }}>
                      <Text style={styles.pillButtonText}>{child.option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      );
    };

    const closeIconSource = Images?.crossIcon ?? null;

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
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Select Task Type</Text>
            </View>
            {closeIconSource && (
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Image
                  source={closeIconSource}
                  style={styles.closeIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            )}
          </View>

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
    header: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.spacing['4'],
      position: 'relative',
    },
    titleContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingRight: theme.spacing['8'],
    },
    title: {
      ...theme.typography.h3,
      color: theme.colors.text,
      textAlign: 'center',
      lineHeight: theme.typography.h3.fontSize * 1.3,
      fontSize: theme.typography.h3.fontSize - 2,
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
