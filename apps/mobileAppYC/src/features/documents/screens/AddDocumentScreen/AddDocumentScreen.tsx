/* istanbul ignore file -- document upload UI relies on native modules not mocked in Jest */
import React, {useState, useRef} from 'react';
import {useNavigation, CommonActions} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {
  DocumentForm,
  DocumentFormSheets,
  type DocumentFormData,
} from '@/features/documents/components/DocumentForm/DocumentForm';
import {DiscardChangesBottomSheet} from '@/shared/components/common/DiscardChangesBottomSheet/DiscardChangesBottomSheet';
import {useDocumentFormValidation, useTheme} from '@/hooks';
import {useFormBottomSheets} from '@/shared/hooks/useFormBottomSheets';
import {useFileOperations} from '@/shared/hooks/useFileOperations';
import {useSelector, useDispatch} from 'react-redux';
import type {RootState, AppDispatch} from '@/app/store';
import type {DocumentStackParamList} from '@/navigation/types';
import {
  addDocument,
  uploadDocumentFiles,
} from '@/features/documents/documentSlice';
import {setSelectedCompanion} from '@/features/companion';
import {LiquidGlassHeaderShell} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderShell';

type AddDocumentNavigationProp =
  NativeStackNavigationProp<DocumentStackParamList>;

export const AddDocumentScreen: React.FC = () => {
  const {theme} = useTheme();
  const navigation = useNavigation<AddDocumentNavigationProp>();
  const dispatch = useDispatch<AppDispatch>();
  const formSheets = useFormBottomSheets();

  const companions = useSelector(
    (state: RootState) => state.companion.companions,
  );
  const loading = useSelector((state: RootState) => state.documents.loading);
  const selectedCompanionId = useSelector(
    (state: RootState) => state.companion.selectedCompanionId,
  );

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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const discardSheetRef = useRef<any>(null);

  const {errors, clearError, validateForm, setFormError} =
    useDocumentFormValidation();

  const handleFormChange = (
    field: keyof DocumentFormData,
    value: any,
  ) => {
    setFormData(prev => ({...prev, [field]: value}));
    setHasUnsavedChanges(true);
  };

  const fileOps = useFileOperations({
    files: formData.files,
    setFiles: files => handleFormChange('files', files),
    clearError: () => clearError('files'),
    openSheet: formSheets.openSheet,
    closeSheet: formSheets.closeSheet,
    deleteSheetRef: formSheets.refs.deleteSheetRef,
  });

  const handleCompanionSelect = (id: string | null) => {
    dispatch(setSelectedCompanion(id));
  };

  React.useEffect(() => {
    if (!selectedCompanionId && companions.length > 0) {
      dispatch(setSelectedCompanion(companions[0].id));
    }
  }, [companions, dispatch, selectedCompanionId]);

  const handleBack = () => {
    if (hasUnsavedChanges) {
      discardSheetRef.current?.open();
    } else {
      navigation.goBack();
    }
  };

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
      <SafeArea>
      <LiquidGlassHeaderShell
        header={
          <Header
            title="Add document"
            showBackButton={true}
            onBack={handleBack}
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
      </LiquidGlassHeaderShell>
      </SafeArea>

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
