/* istanbul ignore file -- UI-heavy edit flow pending dedicated integration coverage */
import React, {useState, useRef, useEffect, useMemo} from 'react';
import {View, Text, StyleSheet, BackHandler} from 'react-native';
import {useRoute, RouteProp, CommonActions} from '@react-navigation/native';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {
  DocumentForm,
  DocumentFormSheets,
  type DocumentFormData,
} from '@/features/documents/components/DocumentForm/DocumentForm';
import {DeleteDocumentBottomSheet, type DeleteDocumentBottomSheetRef} from '@/shared/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet';
import {DiscardChangesBottomSheet} from '@/shared/components/common/DiscardChangesBottomSheet/DiscardChangesBottomSheet';
import {useDocumentFormValidation} from '@/hooks';
import {useSelector} from 'react-redux';
import type {RootState} from '@/app/store';
import type {DocumentStackParamList} from '@/navigation/types';
import type {DocumentFile} from '@/features/documents/types';
import {updateDocument, deleteDocument, uploadDocumentFiles} from '@/features/documents/documentSlice';
import {Images} from '@/assets/images';
import {setSelectedCompanion} from '@/features/companion';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {useCompanionFormScreen, useFormFileOperations} from '@/shared/hooks/useFormScreen';

type EditDocumentRouteProp = RouteProp<DocumentStackParamList, 'EditDocument'>;

export const EditDocumentScreen: React.FC = () => {
  const {
    theme,
    dispatch,
    navigation,
    formSheets,
    handleGoBack: handleGoBackBase,
    discardSheetRef,
    markAsChanged,
    companions,
  } = useCompanionFormScreen();

  const route = useRoute<EditDocumentRouteProp>();
  const {documentId} = route.params;

  const document = useSelector((state: RootState) =>
    state.documents.documents.find(doc => doc.id === documentId),
  );
  const loading = useSelector((state: RootState) => state.documents.loading);

  const [selectedCompanionId, setSelectedCompanionId] = useState<string | null>(null);
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

  const deleteDocumentSheetRef = useRef<DeleteDocumentBottomSheetRef>(null);
  const [isDeleteSheetOpen, setIsDeleteSheetOpen] = useState(false);

  useEffect(() => {
    if (document) {
      setSelectedCompanionId(document.companionId);
      dispatch(setSelectedCompanion(document.companionId));
      setFormData({
        category: document.category,
        subcategory: document.subcategory,
        visitType: document.visitType,
        title: document.title,
        businessName: document.businessName,
        hasIssueDate: !!document.issueDate,
        issueDate: document.issueDate ? new Date(document.issueDate) : new Date(),
        files: document.files,
      });
    }
  }, [document, dispatch]);

  // Handle Android back button for delete bottom sheet
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isDeleteSheetOpen) {
        deleteDocumentSheetRef.current?.close();
        setIsDeleteSheetOpen(false);
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [isDeleteSheetOpen]);

  const styles = useMemo(() => createStyles(theme), [theme]);

  const resolveErrorMessage = (error: unknown, fallback: string) => {
    if (typeof error === 'string') {
      return error;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return fallback;
  };

  const handleDelete = () => {
    setIsDeleteSheetOpen(true);
    deleteDocumentSheetRef.current?.open();
  };

  const confirmDeleteDocument = async () => {
    try {
      console.log('[EditDocument] Deleting document:', documentId);
      await dispatch(deleteDocument({documentId})).unwrap();
      console.log('[EditDocument] Document deleted successfully');
      setIsDeleteSheetOpen(false);
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{name: 'DocumentsMain'}],
        }),
      );
    } catch (error) {
      console.error('[EditDocument] Failed to delete document:', error);
      setIsDeleteSheetOpen(false);
      const message = resolveErrorMessage(
        error,
        'Failed to delete document. Please try again.',
      );
      setFormError('files', message);
    }
  };

  const uploadManagedFiles = async (
    fileList: DocumentFile[],
  ): Promise<DocumentFile[]> => {
    const existingFiles = fileList.filter(
      f => f.key || f.s3Url || f.viewUrl || f.downloadUrl,
    );
    const newFiles = fileList.filter(
      f => !(f.key || f.s3Url || f.viewUrl || f.downloadUrl),
    );

    if (newFiles.length === 0) {
      return fileList;
    }

    if (!selectedCompanionId && !document?.companionId) {
      throw new Error('Please select a pet profile to upload documents.');
    }

    console.log('[EditDocument] Uploading new files:', newFiles.length);
    const uploaded = await dispatch(
      uploadDocumentFiles({
        files: newFiles,
        companionId: selectedCompanionId ?? document?.companionId ?? '',
      }),
    ).unwrap();
    console.log('[EditDocument] New files uploaded successfully');
    return [...existingFiles, ...uploaded];
  };

  const handleSave = async () => {
    const {hasError} = validateForm(formData);

    if (hasError) {
      return;
    }

    try {
      console.log('[EditDocument] Starting document update process');

      if (!selectedCompanionId) {
        throw new Error('Please select a pet profile to update documents.');
      }

      const uploadedFiles = await uploadManagedFiles(formData.files);

      await dispatch(
        updateDocument({
          documentId,
          companionId: selectedCompanionId,
          category: formData.category!,
          subcategory: formData.subcategory!,
          visitType: formData.visitType || '',
          title: formData.title,
          businessName: formData.businessName,
          issueDate: formData.hasIssueDate ? formData.issueDate.toISOString() : '',
          files: uploadedFiles,
        }),
      ).unwrap();

      console.log('[EditDocument] Document updated successfully');
      navigation.goBack();
    } catch (error) {
      console.error('[EditDocument] Failed to update document:', error);
      const message = resolveErrorMessage(
        error,
        'Failed to update document. Please try again.',
      );
      setFormError('files', message);
    }
  };

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

  if (!document) {
    return (
      <SafeArea>
        <Header title="Edit document" showBackButton={true} onBack={() => navigation.goBack()} />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorMessage, {color: theme.colors.error}]}>
            Document not found
          </Text>
        </View>
      </SafeArea>
    );
  }

  const handleBack = handleGoBackBase;

  const handleCompanionSelect = (id: string | null) => {
    setSelectedCompanionId(id);
    dispatch(setSelectedCompanion(id));
  };

  const handleCategoryChange = (newCategory: string | null) => {
    handleFormChange('category', newCategory);
    handleFormChange('subcategory', null);
    clearError('category');
    formSheets.closeSheet();
  };

  return (
    <>
      <LiquidGlassHeaderScreen
        header={
          <Header
            title="Edit document"
            showBackButton={true}
            onBack={handleBack}
            onRightPress={handleDelete}
            rightIcon={Images.deleteIconRed}
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
            showNote={false}
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
        onCategoryChange={handleCategoryChange}
      />

      <DeleteDocumentBottomSheet
        ref={deleteDocumentSheetRef}
        documentTitle={document?.title || 'this document'}
        onDelete={confirmDeleteDocument}
      />

      <DiscardChangesBottomSheet
        ref={discardSheetRef}
        onDiscard={() => navigation.goBack()}
      />
    </>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorMessage: {
      ...theme.typography.body,
      color: theme.colors.error,
    },
  });
