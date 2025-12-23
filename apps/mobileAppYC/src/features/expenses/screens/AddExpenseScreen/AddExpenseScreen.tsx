import React, {useState, useRef, useMemo} from 'react';
import {useNavigation, CommonActions} from '@react-navigation/native';
import {Alert, StyleSheet} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Header} from '@/shared/components/common/Header/Header';
import {
  ExpenseForm,
  ExpenseFormSheets,
  type ExpenseFormData,
} from '@/features/expenses/components';
import {DiscardChangesBottomSheet} from '@/shared/components/common/DiscardChangesBottomSheet/DiscardChangesBottomSheet';
import {useExpenseForm, DEFAULT_FORM} from '@/features/expenses/hooks/useExpenseForm';
import type {AppDispatch, RootState} from '@/app/store';
import {setSelectedCompanion} from '@/features/companion';
import {addExternalExpense} from '@/features/expenses';
import type {ExpenseStackParamList} from '@/navigation/types';
import {useTheme} from '@/hooks';
import {LiquidGlassHeaderShell} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderShell';
import {useFormBottomSheets} from '@/shared/hooks/useFormBottomSheets';
import {useFileOperations} from '@/shared/hooks/useFileOperations';

type Navigation = NativeStackNavigationProp<ExpenseStackParamList, 'AddExpense'>;

export const AddExpenseScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const formSheets = useFormBottomSheets();

  const companions = useSelector((state: RootState) => state.companion.companions);
  const selectedCompanionId = useSelector(
    (state: RootState) => state.companion.selectedCompanionId,
  );
  const currencyCode = useSelector(
    (state: RootState) => state.auth.user?.currency ?? 'USD',
  );
  const loading = useSelector((state: RootState) => state.expenses.loading);

  const {formData, errors, handleChange, handleErrorClear, validate} =
    useExpenseForm(DEFAULT_FORM);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const discardSheetRef = useRef<any>(null);

  const handleGoBack = () => {
    if (hasUnsavedChanges) {
      discardSheetRef.current?.open();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleChangeWithTracking = <K extends keyof ExpenseFormData>(field: K, value: ExpenseFormData[K]) => {
    handleChange(field, value);
    setHasUnsavedChanges(true);
  };

  const fileOps = useFileOperations({
    files: formData.attachments,
    setFiles: files => handleChangeWithTracking('attachments', files),
    clearError: () => handleErrorClear('attachments'),
    openSheet: formSheets.openSheet,
    closeSheet: formSheets.closeSheet,
    deleteSheetRef: formSheets.refs.deleteSheetRef,
  });

  const handleSave = async () => {
    if (!validate(selectedCompanionId)) return;
    if (!selectedCompanionId || !formData) return;

    try {
      await dispatch(
        addExternalExpense({
          companionId: selectedCompanionId,
          title: formData.title.trim(),
          category: formData.category!,
          subcategory: formData.subcategory!,
          visitType: formData.visitType!,
          amount: Number(formData.amount),
          date: formData.date!.toISOString(),
          attachments: formData.attachments,
          providerName: formData.providerName,
        }),
      ).unwrap();

      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{name: 'ExpensesMain'}],
        }),
      );
    } catch (error) {
      Alert.alert(
        'Unable to save expense',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  return (
    <>
      <SafeAreaView style={styles.container}>
        <LiquidGlassHeaderShell
          header={<Header title="Expenses" showBackButton onBack={handleGoBack} glass={false} />}
          contentPadding={theme.spacing['3']}>
          {contentPaddingStyle => (
            <ExpenseForm
              companions={companions}
              selectedCompanionId={selectedCompanionId}
              onCompanionSelect={id => {
                dispatch(setSelectedCompanion(id));
                setHasUnsavedChanges(true);
              }}
              formData={formData!}
              onFormChange={handleChangeWithTracking}
              errors={errors}
              onErrorClear={handleErrorClear}
              loading={loading}
              onSave={handleSave}
              currencyCode={currencyCode}
              saveButtonText="Save"
              contentContainerStyle={contentPaddingStyle}
              formSheetRefs={formSheets.refs}
              openSheet={formSheets.openSheet}
              closeSheet={formSheets.closeSheet}
              fileOperations={fileOps}
              renderBottomSheets={false}
            />
          )}
        </LiquidGlassHeaderShell>
      </SafeAreaView>

      <ExpenseFormSheets
        formData={formData}
        onFormChange={handleChangeWithTracking}
        onErrorClear={handleErrorClear}
        fileOperations={fileOps}
        formSheetRefs={formSheets.refs}
        closeSheet={formSheets.closeSheet}
      />

      <DiscardChangesBottomSheet
        ref={discardSheetRef}
        onDiscard={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }}
      />
    </>
  );
};

export default AddExpenseScreen;

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
  });
