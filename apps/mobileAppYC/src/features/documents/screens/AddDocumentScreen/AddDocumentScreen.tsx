/* istanbul ignore file -- document upload UI relies on native modules not mocked in Jest */
import React, {useState} from 'react';
import {CommonActions} from '@react-navigation/native';
import {useSelector} from 'react-redux';
import type {RootState} from '@/app/store';
import {Header} from '@/shared/components/common/Header/Header';
import {
  DocumentForm,
  DocumentFormSheets,
  type DocumentFormData,
} from '@/features/documents/components/DocumentForm/DocumentForm';
import {DiscardChangesBottomSheet} from '@/shared/components/common/DiscardChangesBottomSheet/DiscardChangesBottomSheet';
import {useDocumentFormValidation} from '@/hooks';
import {
  addDocument,
  uploadDocumentFiles,
} from '@/features/documents/documentSlice';
import {setSelectedCompanion} from '@/features/companion';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {useCompanionFormScreen, useFormFileOperations} from '@/shared/hooks/useFormScreen';

export const AddDocumentScreen: React.FC = () => {
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

  const loading = useSelector((state: any) => state.documents.loading);

  const [formData, setFormData] = useState<DocumentFormData>({
    category: null,
    subcategory: null,
    visitType: null,
    title: '',
    businessName: '',
    hasIssueDate: true,
    issueDate: new Date(),
    files: [],
  });

  const {errors, clearError, validateForm, setFormError} =
    useDocumentFormValidation();

  const handleFormChange = (field: keyof DocumentFormData, value: any) => {
    setFormData(prev => ({...prev, [field]: value}));
    markAsChanged();
  };

  const fileOps = useFormFileOperations(
    formData.files,
    'files' as keyof DocumentFormData,
    handleFormChange,
    clearError,
    formSheets,
  );

  const handleCompanionSelect = (id: string | null) => {
    dispatch(setSelectedCompanion(id));
  };

  React.useEffect(() => {
    if (!selectedCompanionId && companions.length > 0) {
      dispatch(setSelectedCompanion(companions[0].id));
    }
  }, [companions, dispatch, selectedCompanionId]);

  const handleSave = async () => {
    const {hasError} = validateForm(formData);

    if (hasError) {
      return;
    }

    try {
      if (!selectedCompanionId) {
        throw new Error('Please select a pet profile to upload documents.');
      }

      console.log('[AddDocument] Starting document upload and save process');

      const uploadedFiles = await dispatch(
        uploadDocumentFiles({
          files: formData.files,
          companionId: selectedCompanionId,
        })
      ).unwrap();
      console.log('[AddDocument] Files uploaded successfully:', uploadedFiles.length);

      await dispatch(
        addDocument({
          companionId: selectedCompanionId,
          category: formData.category!,
          subcategory: formData.subcategory!,
          visitType: formData.visitType || '',
          title: formData.title,
          businessName: formData.businessName,
          issueDate: formData.hasIssueDate ? formData.issueDate.toISOString() : '',
          files: uploadedFiles,
          appointmentId: '',
        }),
      ).unwrap();

      console.log('[AddDocument] Document added successfully');
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{name: 'DocumentsMain'}],
        }),
      );
    } catch (error: any) {
      console.error('[AddDocument] Failed to add document:', error);
      const message =
        typeof error === 'string'
          ? error
          : error?.message || 'Failed to add document. Please try again.';
      setFormError('files', message);
    }
  };

  return (
    <>
      <LiquidGlassHeaderScreen
        header={
          <Header
            title="Add document"
            showBackButton={true}
            onBack={handleGoBack}
            glass={false}
          />
        }
        contentPadding={theme.spacing['3']}>
        {contentPaddingStyle => (
          <DocumentForm
            companions={companions}
            selectedCompanionId={selectedCompanionId}
            onCompanionSelect={handleCompanionSelect}
            formData={formData}
            onFormChange={handleFormChange}
            errors={errors}
            onErrorClear={clearError}
            loading={loading}
            onSave={handleSave}
            saveButtonText="Save"
            showNote={true}
            contentContainerStyle={contentPaddingStyle ?? undefined}
            formSheetRefs={formSheets.refs}
            openSheet={formSheets.openSheet}
            closeSheet={formSheets.closeSheet}
            fileOperations={fileOps}
            renderBottomSheets={false}
          />
        )}
      </LiquidGlassHeaderScreen>

      <DocumentFormSheets
        formData={formData}
        onFormChange={handleFormChange}
        onErrorClear={clearError}
        fileOperations={fileOps}
        formSheetRefs={formSheets.refs}
        closeSheet={formSheets.closeSheet}
        onCategoryChange={value => {
          handleFormChange('category', value);
          handleFormChange('subcategory', null);
          clearError('category');
          formSheets.closeSheet();
        }}
      />

      <DiscardChangesBottomSheet
        ref={discardSheetRef}
        onDiscard={() => navigation.goBack()}
      />
    </>
  );
};
