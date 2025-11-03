import {useState} from 'react';
import {Alert} from 'react-native';
import type {ExpenseFormData, ExpenseFormErrors} from '@/features/expenses/components';

export const DEFAULT_FORM: ExpenseFormData = {
  category: null,
  subcategory: null,
  visitType: null,
  title: '',
  date: null,
  amount: '',
  attachments: [],
  providerName: '',
};

export function useExpenseForm(initial?: ExpenseFormData | null, requireCompanion = true) {
  const [formData, setFormData] = useState<ExpenseFormData | null>(initial ?? DEFAULT_FORM);
  const [errors, setErrors] = useState<ExpenseFormErrors>({});

  const handleChange = <K extends keyof ExpenseFormData>(field: K, value: ExpenseFormData[K]) => {
    setFormData(prev => (prev ? {...prev, [field]: value} : prev));
  };

  const handleErrorClear = (field: keyof ExpenseFormErrors) => {
    setErrors(prev => ({...prev, [field]: undefined}));
  };

  const validate = (selectedCompanionId?: string | null): boolean => {
    if (requireCompanion && !selectedCompanionId) {
      Alert.alert('Select companion', 'Please select a companion before saving the expense.');
      return false;
    }

    if (!formData) {
      return false;
    }

    const nextErrors: ExpenseFormErrors = {};
    if (!formData.category) {
      nextErrors.category = 'Please choose a category';
    }
    if (!formData.subcategory) {
      nextErrors.subcategory = 'Please choose a sub category';
    }
    if (!formData.visitType) {
      nextErrors.visitType = 'Visit type is required';
    }
    if (!formData.title.trim()) {
      nextErrors.title = 'Expense name is required';
    }
    if (!formData.date) {
      nextErrors.date = 'Pick a date';
    }
    if (!formData.amount || Number.isNaN(Number(formData.amount))) {
      nextErrors.amount = 'Enter a valid amount';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  return {
    formData,
    setFormData,
    errors,
    handleChange,
    handleErrorClear,
    validate,
  } as const;
}
