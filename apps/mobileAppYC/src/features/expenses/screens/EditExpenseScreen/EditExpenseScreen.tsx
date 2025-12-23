import React, {useEffect, useRef, useState} from 'react';
import {Alert, BackHandler} from 'react-native';
import {useRoute, CommonActions} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useSelector} from 'react-redux';
import {Header} from '@/shared/components/common/Header/Header';
import {
  ExpenseForm,
  ExpenseFormSheets,
  type ExpenseFormData,
} from '@/features/expenses/components';
import {DiscardChangesBottomSheet} from '@/shared/components/common/DiscardChangesBottomSheet/DiscardChangesBottomSheet';
import {useExpenseForm} from '@/features/expenses/hooks/useExpenseForm';
import type {RootState} from '@/app/store';
import {setSelectedCompanion} from '@/features/companion';
import {
  deleteExternalExpense,
  selectExpenseById,
  updateExternalExpense,
} from '@/features/expenses';
import type {ExpenseStackParamList} from '@/navigation/types';
import {Images} from '@/assets/images';
import {
  DeleteDocumentBottomSheet,
  type DeleteDocumentBottomSheetRef,
} from '@/shared/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {useCompanionFormScreen, useFormFileOperations} from '@/shared/hooks/useFormScreen';

type Navigation = NativeStackNavigationProp<ExpenseStackParamList, 'EditExpense'>;
type Route = RouteProp<ExpenseStackParamList, 'EditExpense'>;

export const EditExpenseScreen: React.FC = () => {
  const route = useRoute<Route>();
  const {
    theme,
    dispatch,
    navigation,
    formSheets,
    handleGoBack: handleGoBackBase,
    discardSheetRef,
    markAsChanged,
    companions,
    selectedCompanionId,
  } = useCompanionFormScreen();

  const {expenseId} = route.params;
  const expense = useSelector(selectExpenseById(expenseId));
  const currencyCode = useSelector(
    (state: RootState) => state.auth.user?.currency ?? 'USD',
  );
  const loading = useSelector((state: RootState) => state.expenses.loading);

  const {formData, setFormData, errors, handleChange, handleErrorClear, validate} =
    useExpenseForm(null);
  const deleteSheetRef = useRef<DeleteDocumentBottomSheetRef>(null);
  const [isDeleteSheetOpen, setIsDeleteSheetOpen] = useState(false);

  useEffect(() => {
    if (!expense) {
      navigation.goBack();
      return;
    }

    if (expense.source !== 'external') {
      Alert.alert(
        'Non editable',
        'Only expenses added from the app can be edited.',
      );
      navigation.goBack();
      return;
    }

    setFormData({
      category: expense.category,
      subcategory: expense.subcategory,
      visitType: expense.visitType,
      title: expense.title,
      date: new Date(expense.date),
      amount: expense.amount.toString(),
      attachments: expense.attachments,
      providerName: expense.providerName,
    });

    if (!selectedCompanionId || selectedCompanionId !== expense.companionId) {
      dispatch(setSelectedCompanion(expense.companionId));
    }
  }, [dispatch, expense, navigation, selectedCompanionId, setFormData]);

  // Handle Android back button for delete bottom sheet
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isDeleteSheetOpen) {
        deleteSheetRef.current?.close();
        setIsDeleteSheetOpen(false);
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [isDeleteSheetOpen]);

  const handleSave = async () => {
    if (!formData || !expense) {
      return;
    }
    if (!validate(expense.companionId || selectedCompanionId)) {
      return;
    }

    try {
      await dispatch(
        updateExternalExpense({
          expenseId: expense.id,
          updates: {
            category: formData.category!,
            subcategory: formData.subcategory!,
            visitType: formData.visitType!,
            title: formData.title.trim(),
            date: formData.date!.toISOString(),
            amount: Number(formData.amount),
            attachments: formData.attachments,
            providerName: formData.providerName,
          },
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
        'Unable to update expense',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  const handleDelete = () => {
    setIsDeleteSheetOpen(true);
    deleteSheetRef.current?.open();
  };

  const confirmDeleteExpense = async () => {
    if (!expense) {
      return;
    }
    try {
      await dispatch(
        deleteExternalExpense({
          expenseId: expense.id,
          companionId: expense.companionId,
        }),
      ).unwrap();
      setIsDeleteSheetOpen(false);
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{name: 'ExpensesMain'}],
        }),
      );
    } catch (error) {
      setIsDeleteSheetOpen(false);
      Alert.alert(
        'Unable to delete expense',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

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

  const handleGoBack = handleGoBackBase;

  if (!expense || !formData) {
    return null;
  }

  return (
    <>
      <LiquidGlassHeaderScreen
        header={
          <Header
            title="Edit Expense"
            showBackButton
            onBack={handleGoBack}
            rightIcon={Images.deleteIconRed}
            onRightPress={handleDelete}
            glass={false}
          />
        }
        contentPadding={theme.spacing['3']}
        useSafeAreaView>
        {contentPaddingStyle => (
          <ExpenseForm
            companions={companions}
            selectedCompanionId={expense.companionId || selectedCompanionId}
            onCompanionSelect={id => {
              dispatch(setSelectedCompanion(id));
              markAsChanged();
            }}
            formData={formData}
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
        formData={formData}
        onFormChange={handleChangeWithTracking}
        onErrorClear={handleErrorClear}
        fileOperations={fileOps}
        formSheetRefs={formSheets.refs}
        closeSheet={formSheets.closeSheet}
      />
      <DeleteDocumentBottomSheet
        ref={deleteSheetRef}
        documentTitle={expense?.title ?? 'this expense'}
        title="Delete expense"
        message={
          expense
            ? `Are you sure you want to delete the expense ${expense.title}?`
            : 'Are you sure you want to delete this expense?'
        }
        primaryLabel="Delete"
        secondaryLabel="Cancel"
        onDelete={confirmDeleteExpense}
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

export default EditExpenseScreen;
