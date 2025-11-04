/* istanbul ignore file -- validation logic for document forms */
import {useState, useCallback} from 'react';
import type {DocumentFormData, DocumentFormErrors} from '@/features/documents/components/DocumentForm/DocumentForm';

export const useDocumentFormValidation = () => {
  const [errors, setErrors] = useState<DocumentFormErrors>({
    category: '',
    subcategory: '',
    title: '',
    businessName: '',
    issueDate: '',
    files: '',
  });

  const clearError = useCallback((field: keyof DocumentFormErrors) => {
    setErrors(prev => ({...prev, [field]: ''}));
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({
      category: '',
      subcategory: '',
      title: '',
      businessName: '',
      issueDate: '',
      files: '',
    });
  }, []);

  const validateForm = useCallback((formData: DocumentFormData) => {
    const newErrors: DocumentFormErrors = {
      category: '',
      subcategory: '',
      title: '',
      businessName: '',
      issueDate: '',
      files: '',
    };

    let hasError = false;

    if (!formData.category) {
      newErrors.category = 'Category missing';
      hasError = true;
    }
    if (!formData.subcategory) {
      newErrors.subcategory = 'Sub category missing';
      hasError = true;
    }
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
      hasError = true;
    }
    if (!formData.businessName.trim()) {
      newErrors.businessName = 'Business name is required';
      hasError = true;
    }
    if (formData.hasIssueDate && !formData.issueDate) {
      newErrors.issueDate = 'Issue date missing';
      hasError = true;
    }
    if (formData.files.length === 0) {
      newErrors.files = 'Document missing';
      hasError = true;
    }

    setErrors(newErrors);
    return {hasError, errors: newErrors};
  }, []);

  const setFormError = useCallback((field: keyof DocumentFormErrors, message: string) => {
    setErrors(prev => ({...prev, [field]: message}));
  }, []);

  return {
    errors,
    clearError,
    clearAllErrors,
    validateForm,
    setFormError,
  };
};
