/* istanbul ignore file -- document upload UI relies on native modules not mocked in Jest */
import React, {useState, useRef} from 'react';
import {useNavigation, CommonActions} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeArea} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {DocumentForm, type DocumentFormData} from '@/components/documents/DocumentForm/DocumentForm';
import {DiscardChangesBottomSheet} from '@/components/common/DiscardChangesBottomSheet/DiscardChangesBottomSheet';
import {useDocumentFormValidation} from '@/hooks';
import {useSelector, useDispatch} from 'react-redux';
import type {RootState, AppDispatch} from '@/app/store';
import type {DocumentStackParamList} from '@/navigation/types';
import {
  addDocument,
  uploadDocumentFiles,
} from '@/features/documents/documentSlice';
import {setSelectedCompanion} from '@/features/companion';

type AddDocumentNavigationProp =
  NativeStackNavigationProp<DocumentStackParamList>;

export const AddDocumentScreen: React.FC = () => {
  const navigation = useNavigation<AddDocumentNavigationProp>();
  const dispatch = useDispatch<AppDispatch>();

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

  const handleCompanionSelect = (id: string | null) => {
    dispatch(setSelectedCompanion(id));
  };

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
      console.log('[AddDocument] Starting document upload and save process');

      const uploadedFiles = await dispatch(
        uploadDocumentFiles(formData.files)
      ).unwrap();
      console.log('[AddDocument] Files uploaded successfully:', uploadedFiles.length);

      await dispatch(
        addDocument({
          companionId: selectedCompanionId!,
          category: formData.category!,
          subcategory: formData.subcategory!,
          visitType: formData.visitType || 'general',
          title: formData.title,
          businessName: formData.businessName,
          issueDate: formData.hasIssueDate ? formData.issueDate.toISOString() : '',
          files: uploadedFiles,
          isSynced: false,
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
      setFormError(
        'files',
        error.message || 'Failed to add document. Please try again.'
      );
    }
  };

  return (
    <SafeArea>
      <Header
        title="Add document"
        showBackButton={true}
        onBack={handleBack}
      />
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
      />

      <DiscardChangesBottomSheet
        ref={discardSheetRef}
        onDiscard={() => navigation.goBack()}
      />
    </SafeArea>
  );
};
