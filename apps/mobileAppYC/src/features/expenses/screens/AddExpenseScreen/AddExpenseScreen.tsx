import React from 'react';
import {CommonActions} from '@react-navigation/native';
import {Alert} from 'react-native';
import {useSelector} from 'react-redux';
import {Header} from '@/shared/components/common/Header/Header';
import {
  ExpenseForm,
  ExpenseFormSheets,
  type ExpenseFormData,
} from '@/features/expenses/components';
import {DiscardChangesBottomSheet} from '@/shared/components/common/DiscardChangesBottomSheet/DiscardChangesBottomSheet';
import {useExpenseForm, DEFAULT_FORM} from '@/features/expenses/hooks/useExpenseForm';
import type {RootState} from '@/app/store';
import {setSelectedCompanion} from '@/features/companion';
import {addExternalExpense} from '@/features/expenses';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {useCompanionFormScreen, useFormFileOperations} from '@/shared/hooks/useFormScreen';

export const AddExpenseScreen: React.FC = () => {
  const {
    theme,
    dispatch,
    navigation,
    formSheets,
    handleGoBack,
    discardSheetRef,
    markAsChanged,
    companions,
    selectedCompanionId,
  } = useCompanionFormScreen();

  const currencyCode = useSelector(
    (state: RootState) => state.auth.user?.currency ?? 'USD',
  );
  const loading = useSelector((state: RootState) => state.expenses.loading);

  const {formData, errors, handleChange, handleErrorClear, validate} =
    useExpenseForm(DEFAULT_FORM);

  const handleChangeWithTracking = <K extends keyof ExpenseFormData>(
    field: K,
    value: ExpenseFormData[K],
  ) => {
    handleChange(field, value);
    markAsChanged();
  };

  const fileOps = useFormFileOperations(
    formData?.attachments ?? [],
    'attachments' as keyof ExpenseFormData,
    handleChangeWithTracking,
    handleErrorClear,
    formSheets,
  );

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
      <LiquidGlassHeaderScreen
        header={<Header title="Expenses" showBackButton onBack={handleGoBack} glass={false} />}
        contentPadding={theme.spacing['3']}
        useSafeAreaView>
        {contentPaddingStyle => (
          <ExpenseForm
            companions={companions}
            selectedCompanionId={selectedCompanionId}
            onCompanionSelect={id => {
              dispatch(setSelectedCompanion(id));
              markAsChanged();
            }}
            formData={formData ?? DEFAULT_FORM}
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
      </LiquidGlassHeaderScreen>

      <ExpenseFormSheets
        formData={formData ?? DEFAULT_FORM}
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
