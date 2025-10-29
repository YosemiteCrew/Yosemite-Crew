/* istanbul ignore file -- UI-heavy edit flow pending dedicated integration coverage */
import React, {useState, useRef, useEffect} from 'react';
import {View, Text, StyleSheet, BackHandler} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {DocumentForm, type DocumentFormData} from '@/features/documents/components/DocumentForm/DocumentForm';
import {DeleteDocumentBottomSheet, type DeleteDocumentBottomSheetRef} from '@/shared/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet';
import {DiscardChangesBottomSheet} from '@/shared/components/common/DiscardChangesBottomSheet/DiscardChangesBottomSheet';
import {useTheme, useDocumentFormValidation} from '@/hooks';
import {useSelector, useDispatch} from 'react-redux';
import type {RootState, AppDispatch} from '@/app/store';
import type {DocumentStackParamList} from '@/navigation/types';
import type {DocumentFile} from '@/features/documents/types';
import {updateDocument, deleteDocument, uploadDocumentFiles} from '@/features/documents/documentSlice';
import {Images} from '@/assets/images';
import {setSelectedCompanion} from '@/features/companion';

type EditDocumentNavigationProp = NativeStackNavigationProp<DocumentStackParamList>;
type EditDocumentRouteProp = RouteProp<DocumentStackParamList, 'EditDocument'>;

export const EditDocumentScreen: React.FC = () => {
  const {theme} = useTheme();
  const navigation = useNavigation<EditDocumentNavigationProp>();
  const route = useRoute<EditDocumentRouteProp>();
  const dispatch = useDispatch<AppDispatch>();

  const {documentId} = route.params;

  const document = useSelector((state: RootState) =>
    state.documents.documents.find(doc => doc.id === documentId),
  );
  const companions = useSelector((state: RootState) => state.companion.companions);
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
  const discardSheetRef = useRef<any>(null);
  const [isDeleteSheetOpen, setIsDeleteSheetOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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

  const handleDelete = () => {
    setIsDeleteSheetOpen(true);
    deleteDocumentSheetRef.current?.open();
  };

  const confirmDeleteDocument = async () => {
    try {
      console.log('[EditDocument] Deleting document:', documentId);
      await dispatch(deleteDocument(documentId)).unwrap();
      console.log('[EditDocument] Document deleted successfully');
      setIsDeleteSheetOpen(false);
      navigation.goBack();
    } catch (error) {
      console.error('[EditDocument] Failed to delete document:', error);
      setIsDeleteSheetOpen(false);
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to delete document. Please try again.';
      setFormError('files', message);
    }
  };

  const uploadManagedFiles = async (
    fileList: DocumentFile[],
  ): Promise<DocumentFile[]> => {
    const existingFiles = fileList.filter(f => f.s3Url);
    const newFiles = fileList.filter(f => !f.s3Url);

    if (newFiles.length === 0) {
      return existingFiles;
    }

    console.log('[EditDocument] Uploading new files:', newFiles.length);
    const uploaded = await dispatch(uploadDocumentFiles(newFiles)).unwrap();
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

      const uploadedFiles = await uploadManagedFiles(formData.files);

      await dispatch(
        updateDocument({
          documentId,
          updates: {
            category: formData.category!,
            subcategory: formData.subcategory!,
            visitType: formData.visitType || 'general',
            title: formData.title,
            businessName: formData.businessName,
            issueDate: formData.hasIssueDate ? formData.issueDate.toISOString() : '',
            files: uploadedFiles,
          },
        }),
      ).unwrap();

      console.log('[EditDocument] Document updated successfully');
      navigation.goBack();
    } catch (error) {
      console.error('[EditDocument] Failed to update document:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to update document. Please try again.';
      setFormError('files', message);
    }
  };

  const handleFormChange = (field: keyof DocumentFormData, value: any) => {
    setFormData(prev => ({...prev, [field]: value}));
    setHasUnsavedChanges(true);
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      discardSheetRef.current?.open();
    } else {
      navigation.goBack();
    }
  };

  const handleCompanionSelect = (id: string | null) => {
    setSelectedCompanionId(id);
    dispatch(setSelectedCompanion(id));
  };

  return (
    <SafeArea>
      <Header
        title="Edit document"
        showBackButton={true}
        onBack={handleBack}
        onRightPress={handleDelete}
        rightIcon={Images.deleteIconRed}
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
        showNote={false}
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
    </SafeArea>
  );
};

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorMessage: {
    fontSize: 16,
  },
});
