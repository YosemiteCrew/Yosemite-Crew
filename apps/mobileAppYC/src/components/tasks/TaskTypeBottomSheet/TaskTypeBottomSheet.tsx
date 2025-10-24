import React, {forwardRef, useRef, useState, useMemo, useImperativeHandle, useEffect} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Image, ScrollView} from 'react-native';
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

export const TaskTypeBottomSheet = forwardRef<TaskTypeBottomSheetRef, TaskTypeBottomSheetProps>(
  ({onSelect, companionType: _companionType = 'dog'}, ref) => {
    const {theme} = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const bottomSheetRef = useRef<BottomSheetRef>(null);
    const [currentLevel, setCurrentLevel] = useState<TaskTypeOption[]>([]);
    const [breadcrumb, setBreadcrumb] = useState<TaskTypeOption[]>([]);

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
                    id: 'flea-medication',
                    label: 'Give medication',
                    taskType: 'give-medication',
                  },
                  {
                    id: 'flea-tool',
                    label: 'Take observational tool',
                    taskType: 'take-observational-tool',
                  },
                ],
              },
            ],
          },
          {
            id: 'health-chronic',
            label: 'Chronic Conditions',
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
        label: 'Hygiene Maintenance',
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
        label: 'Dietary Plan',
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

    // Initialize currentLevel with root task type options
    // taskTypeOptions is memoized and stable across renders
    useEffect(() => {
      setCurrentLevel(taskTypeOptions);
    }, [taskTypeOptions]);

    const buildSelectionFromOption = (
      option: TaskTypeOption,
      ancestors: TaskTypeOption[],
    ): TaskTypeSelection => {
      let category: TaskCategory = 'custom';
      let subcategory: HealthSubcategory | undefined;
      let parasitePreventionType: ParasitePreventionType | undefined;
      let chronicConditionType: ChronicConditionType | undefined;
      let taskType: string | undefined;

      // Check option first, then traverse up through ancestors
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

    const handleGoBack = () => {
      if (breadcrumb.length > 0) {
        const newBreadcrumb = [...breadcrumb];
        newBreadcrumb.pop();
        setBreadcrumb(newBreadcrumb);

        if (newBreadcrumb.length > 0) {
          setCurrentLevel(newBreadcrumb[newBreadcrumb.length - 1].children || []);
        } else {
          setCurrentLevel(taskTypeOptions);
        }
      }
    };

    const renderOption = (option: TaskTypeOption) => {
      const hasChildren = option.children && option.children.length > 0;

      return (
        <TouchableOpacity
          key={option.id}
          style={[
            styles.optionContainer,
            hasChildren && styles.categoryStyle,
          ]}
          onPress={() => {
            if (option.children && option.children.length > 0) {
              // Navigate to children
              setCurrentLevel(option.children);
              setBreadcrumb([...breadcrumb, option]);
            } else {
              // Leaf node - select immediately
              const selection = buildSelectionFromOption(option, breadcrumb);
              onSelect(selection);
              bottomSheetRef.current?.close();
            }
          }}>
          <View style={styles.optionContent}>
            <Text
              style={[
                styles.optionText,
                hasChildren && styles.categoryText,
              ]}>
              {option.label}
            </Text>
          </View>
          {hasChildren && <Image source={Images.rightArrowIcon} style={styles.chevronIcon} />}
        </TouchableOpacity>
      );
    };

    const breadcrumbPath = breadcrumb.map(item => item.label).join(' > ') || 'Select Task Type';
    const closeIconSource = Images?.crossIcon ?? null;

    const handleClose = () => {
      setBreadcrumb([]);
      setCurrentLevel(taskTypeOptions);
      bottomSheetRef.current?.close();
    };

    return (
      <CustomBottomSheet
        ref={bottomSheetRef}
        snapPoints={['25%', '40%']}
        initialIndex={-1}
        enablePanDownToClose
        enableBackdrop
        backdropOpacity={0.5}
        backdropDisappearsOnIndex={-1}
        contentType="view"
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetHandle}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{breadcrumbPath}</Text>
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

          {breadcrumb.length > 0 && (
            <TouchableOpacity style={styles.backButtonContainer} onPress={handleGoBack}>
              <Image source={Images.leftArrowIcon} style={styles.backIcon} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {currentLevel.map((option) => (
              <View key={option.id} style={styles.optionWrapper}>
                {renderOption(option)}
              </View>
            ))}
          </ScrollView>
        </View>
      </CustomBottomSheet>
    );
  },
);

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
      paddingRight: theme.spacing['8'], // Account for close button
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
    backButtonContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing['3'],
      paddingVertical: theme.spacing['3'],
      gap: theme.spacing['2'],
      marginBottom: theme.spacing['2'],
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backIcon: {
      width: theme.spacing['6'],
      height: theme.spacing['6'],
      resizeMode: 'contain',
    },
    backButtonText: {
      ...theme.typography.body,
      fontWeight: '600',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingVertical: theme.spacing['2'],
    },
    optionWrapper: {
      width: '100%',
    },
    optionContainer: {
      paddingVertical: 14,
      paddingHorizontal: theme.spacing['3'],
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      borderRadius: theme.borderRadius.base,
      marginBottom: theme.spacing['1'],
    },
    categoryStyle: {
      backgroundColor: theme.colors.surface,
      paddingVertical: 12,
      paddingHorizontal: theme.spacing['3'],
      borderBottomWidth: 0,
      borderRadius: theme.borderRadius.base,
      marginBottom: theme.spacing['1'],
    },
    optionContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    optionText: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '500',
      flex: 1,
    },
    categoryText: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600',
    },
    chevronIcon: {
      width: theme.spacing['6'],
      height: theme.spacing['6'],
      resizeMode: 'contain',
    },
  });

export default TaskTypeBottomSheet;
