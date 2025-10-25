import React, {useState, useRef} from 'react';
import {useNavigation, CommonActions} from '@react-navigation/native';
import {Alert} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import {SafeArea} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {ExpenseForm, type ExpenseFormData} from '@/components/expenses';
import {DiscardChangesBottomSheet} from '@/components/common/DiscardChangesBottomSheet/DiscardChangesBottomSheet';
import {useExpenseForm, DEFAULT_FORM} from '../hooks/useExpenseForm';
import type {AppDispatch, RootState} from '@/app/store';
import {setSelectedCompanion} from '@/features/companion';
import {addExternalExpense} from '@/features/expenses';
import type {ExpenseStackParamList} from '@/navigation/types';

type Navigation = NativeStackNavigationProp<ExpenseStackParamList, 'AddExpense'>;

export const AddExpenseScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const dispatch = useDispatch<AppDispatch>();

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
    <SafeArea>
      <Header title="Expenses" showBackButton onBack={handleGoBack} />
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
      />

      <DiscardChangesBottomSheet
        ref={discardSheetRef}
        onDiscard={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }}
      />
    </SafeArea>
  );
};

export default AddExpenseScreen;
