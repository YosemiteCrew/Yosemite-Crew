/* istanbul ignore file -- UI-heavy edit flow pending dedicated integration coverage */
import React, {useState, useRef, useMemo, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeArea, Input} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {CompanionSelector} from '@/components/common/CompanionSelector/CompanionSelector';
import {SimpleDatePicker, formatDateForDisplay} from '@/components/common/SimpleDatePicker/SimpleDatePicker';
import {CategoryBottomSheet} from '@/components/common/CategoryBottomSheet/CategoryBottomSheet';
import {SubcategoryBottomSheet} from '@/components/common/SubcategoryBottomSheet/SubcategoryBottomSheet';
import {VisitTypeBottomSheet} from '@/components/common/VisitTypeBottomSheet/VisitTypeBottomSheet';
import {TouchableInput} from '@/components/common/TouchableInput/TouchableInput';
import LiquidGlassButton from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import {UploadDocumentBottomSheet, type UploadDocumentBottomSheetRef} from '@/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet';
import {DeleteDocumentBottomSheet, type DeleteDocumentBottomSheetRef} from '@/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet';
import {DocumentAttachmentsSection} from '@/components/documents/DocumentAttachmentsSection';
import {useTheme} from '@/hooks';
import {useSelector, useDispatch} from 'react-redux';
import type {RootState, AppDispatch} from '@/app/store';
import type {DocumentStackParamList} from '@/navigation/types';
import type {DocumentFile} from '@/types/document.types';
import {updateDocument, deleteDocument, uploadDocumentFiles} from '@/features/documents/documentSlice';
import {Images} from '@/assets/images';
import type {CategoryBottomSheetRef} from '@/components/common/CategoryBottomSheet/CategoryBottomSheet';
import type {SubcategoryBottomSheetRef} from '@/components/common/SubcategoryBottomSheet/SubcategoryBottomSheet';
import type {VisitTypeBottomSheetRef} from '@/components/common/VisitTypeBottomSheet/VisitTypeBottomSheet';
import {setSelectedCompanion} from '@/features/companion';

type EditDocumentNavigationProp = NativeStackNavigationProp<DocumentStackParamList>;
type EditDocumentRouteProp = RouteProp<DocumentStackParamList, 'EditDocument'>;

export const EditDocumentScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<EditDocumentNavigationProp>();
  const route = useRoute<EditDocumentRouteProp>();
  const dispatch = useDispatch<AppDispatch>();

  const {documentId} = route.params;

  // Get document from Redux
  const document = useSelector((state: RootState) =>
    state.documents.documents.find(doc => doc.id === documentId),
  );
  const companions = useSelector((state: RootState) => state.companion.companions);
  const loading = useSelector((state: RootState) => state.documents.loading);

  // Form state
  const [selectedCompanionId, setSelectedCompanionId] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [visitType, setVisitType] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [hasIssueDate, setHasIssueDate] = useState(true);
  const [issueDate, setIssueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  // Error states
  const [errors, setErrors] = useState({
    category: '',
    subcategory: '',
    title: '',
    businessName: '',
    issueDate: '',
    files: '',
  });

  // Bottom sheet refs
  const categorySheetRef = useRef<CategoryBottomSheetRef>(null);
  const subcategorySheetRef = useRef<SubcategoryBottomSheetRef>(null);
  const visitTypeSheetRef = useRef<VisitTypeBottomSheetRef>(null);
  const uploadSheetRef = useRef<UploadDocumentBottomSheetRef>(null);
  const deleteFileSheetRef = useRef<DeleteDocumentBottomSheetRef>(null);
  const deleteDocumentSheetRef = useRef<DeleteDocumentBottomSheetRef>(null);

  // Load document data
  useEffect(() => {
    if (document) {
      setSelectedCompanionId(document.companionId);
      // Also sync with Redux when editing
      dispatch(setSelectedCompanion(document.companionId));
      setCategory(document.category);
      setSubcategory(document.subcategory);
      setVisitType(document.visitType);
      setTitle(document.title);
      setBusinessName(document.businessName);
      setHasIssueDate(!!document.issueDate);
      setIssueDate(document.issueDate ? new Date(document.issueDate) : new Date());
      setFiles(document.files);
    }
  }, [document, dispatch]);

  if (!document) {
    return (
      <SafeArea>
        <Header title="Edit document" showBackButton={true} onBack={() => navigation.goBack()} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorMessage}>Document not found</Text>
        </View>
      </SafeArea>
    );
  }

  const handleDelete = () => {
    deleteDocumentSheetRef.current?.open();
  };

  const confirmDeleteDocument = async () => {
    try {
      console.log('[EditDocument] Deleting document:', documentId);
      await dispatch(deleteDocument(documentId)).unwrap();
      console.log('[EditDocument] Document deleted successfully');
      navigation.goBack();
    } catch (error) {
      console.error('[EditDocument] Failed to delete document:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to delete document. Please try again.';
      setErrors(prev => ({
        ...prev,
        files: message,
      }));
    }
  };

  const validateForm = () => {
    const validationErrors = {
      category: '',
      subcategory: '',
      title: '',
      businessName: '',
      issueDate: '',
      files: '',
    };

    const trimmedTitle = title.trim();
    const trimmedBusinessName = businessName.trim();

    const validationRules: Array<{
      field: keyof typeof validationErrors;
      failed: boolean;
      message: string;
    }> = [
      {field: 'category', failed: category === null, message: 'Category missing'},
      {field: 'subcategory', failed: subcategory === null, message: 'Sub category missing'},
      {field: 'title', failed: trimmedTitle.length === 0, message: 'Title is required'},
      {
        field: 'businessName',
        failed: trimmedBusinessName.length === 0,
        message: 'Business name is required',
      },
      {
        field: 'issueDate',
        failed: hasIssueDate && !issueDate,
        message: 'Issue date missing',
      },
      {field: 'files', failed: files.length === 0, message: 'Document missing'},
    ];

    for (const {field, failed, message} of validationRules) {
      if (failed) {
        validationErrors[field] = message;
      }
    }

    const hasValidationError = Object.values(validationErrors).some(
      value => value !== '',
    );

    return {hasValidationError, validationErrors};
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

  const handleUpdateFailure = (error: unknown) => {
    console.error('[EditDocument] Failed to update document:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to update document. Please try again.';
    setErrors(prev => ({
      ...prev,
      files: message,
    }));
  };

  const handleSave = async () => {
    const {hasValidationError, validationErrors} = validateForm();
    setErrors(validationErrors);

    if (hasValidationError || category === null || subcategory === null) {
      return;
    }

    try {
      console.log('[EditDocument] Starting document update process');

      const uploadedFiles = await uploadManagedFiles(files);

      await dispatch(
        updateDocument({
          documentId,
          updates: {
            category,
            subcategory,
            visitType: visitType || 'general',
            title,
            businessName,
            issueDate: hasIssueDate ? issueDate.toISOString() : '',
            files: uploadedFiles,
          },
        }),
      ).unwrap();

      console.log('[EditDocument] Document updated successfully');
      navigation.goBack();
    } catch (error) {
      handleUpdateFailure(error);
    }
  };

  const handleUploadDocuments = () => {
    uploadSheetRef.current?.open();
  };

  const handleTakePhoto = () => {
    const mockFile: DocumentFile = {
      id: `file_${Date.now()}`,
      uri: 'file://mock-photo.jpg',
      name: 'photo.jpg',
      type: 'image/jpeg',
      size: 1024000,
    };
    setFiles([...files, mockFile]);
    if (errors.files) {
      setErrors(prev => ({...prev, files: ''}));
    }
  };

  const handleChooseFromGallery = () => {
    const mockFile: DocumentFile = {
      id: `file_${Date.now()}`,
      uri: 'file://mock-gallery.jpg',
      name: 'gallery-image.jpg',
      type: 'image/jpeg',
      size: 2048000,
    };
    setFiles([...files, mockFile]);
    if (errors.files) {
      setErrors(prev => ({...prev, files: ''}));
    }
  };

  const handleUploadFromDrive = () => {
    const mockFile: DocumentFile = {
      id: `file_${Date.now()}`,
      uri: 'file://mock-drive-doc.pdf',
      name: 'document.pdf',
      type: 'application/pdf',
      size: 3072000,
    };
    setFiles([...files, mockFile]);
    if (errors.files) {
      setErrors(prev => ({...prev, files: ''}));
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setFileToDelete(fileId);
    deleteFileSheetRef.current?.open();
  };

  const confirmDeleteFile = () => {
    if (fileToDelete) {
      setFiles(files.filter(f => f.id !== fileToDelete));
      setFileToDelete(null);
    }
  };

  return (
    <SafeArea>
      <Header
        title="Edit document"
        showBackButton={true}
        onBack={() => navigation.goBack()}
        onRightPress={handleDelete}
        rightIcon={Images.deleteIconRed}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        <CompanionSelector
          companions={companions}
          selectedCompanionId={selectedCompanionId}
          onSelect={(id) => {
            setSelectedCompanionId(id);
            dispatch(setSelectedCompanion(id));
          }}
          showAddButton={false}
          containerStyle={styles.companionSelector}
        />

        <TouchableOpacity onPress={() => categorySheetRef.current?.open()}>
          <Input
            label="Category"
            value={category ? category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ') : ''}
            editable={false}
            pointerEvents="none"
            containerStyle={styles.input}
            icon={<Image source={Images.dropdownIcon} style={styles.dropdownIcon} />}
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => subcategorySheetRef.current?.open()}>
          <Input
            label="Sub category"
            value={subcategory ? subcategory.charAt(0).toUpperCase() + subcategory.slice(1).replace('-', ' ') : ''}
            editable={false}
            pointerEvents="none"
            containerStyle={styles.input}
            icon={<Image source={Images.dropdownIcon} style={styles.dropdownIcon} />}
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => visitTypeSheetRef.current?.open()}>
          <Input
            label="Visit type"
            value={visitType ? visitType.charAt(0).toUpperCase() + visitType.slice(1) : ''}
            editable={false}
            pointerEvents="none"
            containerStyle={styles.input}
            icon={<Image source={Images.dropdownIcon} style={styles.dropdownIcon} />}
          />
        </TouchableOpacity>

        <View>
          <Input
            label="Title"
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              if (errors.title) setErrors(prev => ({...prev, title: ''}));
            }}
            containerStyle={styles.input}
          />
          {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}
        </View>

        <View>
          <Input
            label="Issuing business name"
            value={businessName}
            onChangeText={(text) => {
              setBusinessName(text);
              if (errors.businessName) setErrors(prev => ({...prev, businessName: ''}));
            }}
            containerStyle={styles.input}
          />
          {errors.businessName ? <Text style={styles.errorText}>{errors.businessName}</Text> : null}
        </View>

        <View style={styles.dateSection}>
          <View style={styles.dateSectionHeader}>
            <Text style={styles.label}>Issue date</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setHasIssueDate(!hasIssueDate)}
              style={styles.toggle}>
              <View style={[styles.toggleTrack, hasIssueDate && styles.toggleTrackActive]}>
                <View style={[styles.toggleThumb, hasIssueDate && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>
          </View>
          {hasIssueDate && (
            <TouchableInput
              label=""
              value={formatDateForDisplay(issueDate)}
              placeholder="Select issue date"
              onPress={() => setShowDatePicker(true)}
              rightComponent={
                <Image
                  source={Images.calendarIcon}
                  style={styles.calendarIcon}
                />
              }
              containerStyle={styles.inputContainer}
            />
          )}
        </View>

        <DocumentAttachmentsSection
          files={files}
          onAddPress={handleUploadDocuments}
          onRequestRemove={file => handleRemoveFile(file.id)}
          error={errors.files}
        />

        <View style={styles.saveButton}>
          <LiquidGlassButton
            title={loading ? 'Saving...' : 'Save'}
            onPress={handleSave}
            style={styles.button}
            textStyle={styles.buttonText}
            tintColor={theme.colors.secondary}
            shadowIntensity="medium"
            forceBorder
            borderColor="rgba(255, 255, 255, 0.35)"
            height={56}
            borderRadius={16}
            loading={loading}
            disabled={loading}
          />
        </View>
      </ScrollView>

      <SimpleDatePicker
        value={issueDate}
        onDateChange={(date) => {
          setIssueDate(date);
          setShowDatePicker(false);
        }}
        show={showDatePicker}
        onDismiss={() => setShowDatePicker(false)}
        maximumDate={new Date()}
        mode="date"
      />

      <CategoryBottomSheet
        ref={categorySheetRef}
        selectedCategory={category}
        onSave={setCategory}
      />

      <SubcategoryBottomSheet
        ref={subcategorySheetRef}
        category={category}
        selectedSubcategory={subcategory}
        onSave={setSubcategory}
      />

      <VisitTypeBottomSheet
        ref={visitTypeSheetRef}
        selectedVisitType={visitType}
        onSave={setVisitType}
      />

      <UploadDocumentBottomSheet
        ref={uploadSheetRef}
        onTakePhoto={handleTakePhoto}
        onChooseGallery={handleChooseFromGallery}
        onUploadDrive={handleUploadFromDrive}
      />

      <DeleteDocumentBottomSheet
        ref={deleteFileSheetRef}
        documentTitle={fileToDelete ? files.find(f => f.id === fileToDelete)?.name : 'this file'}
        onDelete={confirmDeleteFile}
      />

      <DeleteDocumentBottomSheet
        ref={deleteDocumentSheetRef}
        documentTitle={document?.title || 'this document'}
        onDelete={confirmDeleteDocument}
      />
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingHorizontal: theme.spacing[4],
      paddingBottom: theme.spacing[24], // Extra padding for tab bar
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorMessage: {
      ...theme.typography.bodyLarge,
      color: theme.colors.error,
    },
    companionSelector: {
      marginTop: theme.spacing[4],
      marginBottom: theme.spacing[4],
    },
    input: {
      marginBottom: theme.spacing[4],
    },
    dropdownIcon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
      tintColor: theme.colors.textSecondary,
    },
    dateSection: {
      marginBottom: theme.spacing[4],
    },
    dateSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing[2],
    },
    label: {
      ...theme.typography.labelMdBold,
      color: theme.colors.secondary,
    },
    toggle: {
      padding: theme.spacing[1],
    },
    toggleTrack: {
      width: 48,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.borderMuted,
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    toggleTrackActive: {
      backgroundColor: theme.colors.primary,
    },
    toggleThumb: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.white,
      alignSelf: 'flex-start',
    },
    toggleThumbActive: {
      alignSelf: 'flex-end',
    },
    datePicker: {
      marginTop: theme.spacing[2],
    },
    saveButton: {
      marginTop: theme.spacing[2],
    },
    button: {
      width: '100%',
      backgroundColor: theme.colors.secondary,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.35)',
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 8},
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 4,
    },
    buttonText: {
      color: theme.colors.white,
      ...theme.typography.paragraphBold,
    },
    calendarIcon: {
      width: theme.spacing[5],
      height: theme.spacing[5],
      tintColor: theme.colors.textSecondary,
    },
    inputContainer: {
      marginBottom: 0,
    },
    errorText: {
      ...theme.typography.labelXsBold,
      color: theme.colors.error,
      marginTop: -theme.spacing[3],
      marginBottom: theme.spacing[3],
      marginLeft: theme.spacing[1],
    },
  });
