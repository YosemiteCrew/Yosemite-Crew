/* istanbul ignore file -- document upload UI relies on native modules not mocked in Jest */
import React, {useState, useRef, useMemo} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import {useNavigation, CommonActions} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeArea, Input} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {CompanionSelector} from '@/components/common/CompanionSelector/CompanionSelector';
import {
  SimpleDatePicker,
  formatDateForDisplay,
} from '@/components/common/SimpleDatePicker/SimpleDatePicker';
import {CategoryBottomSheet} from '@/components/common/CategoryBottomSheet/CategoryBottomSheet';
import {SubcategoryBottomSheet} from '@/components/common/SubcategoryBottomSheet/SubcategoryBottomSheet';
import {VisitTypeBottomSheet} from '@/components/common/VisitTypeBottomSheet/VisitTypeBottomSheet';
import {TouchableInput} from '@/components/common/TouchableInput/TouchableInput';
import LiquidGlassButton from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import {UploadDocumentBottomSheet, type UploadDocumentBottomSheetRef} from '@/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet';
import {DeleteDocumentBottomSheet, type DeleteDocumentBottomSheetRef} from '@/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet';
import {useTheme} from '@/hooks';
import {useSelector, useDispatch} from 'react-redux';
import type {RootState, AppDispatch} from '@/app/store';
import type {DocumentStackParamList} from '@/navigation/types';
import type {DocumentFile} from '@/types/document.types';
import {
  addDocument,
  uploadDocumentFiles,
} from '@/features/documents/documentSlice';
import {Images} from '@/assets/images';
import type {CategoryBottomSheetRef} from '@/components/common/CategoryBottomSheet/CategoryBottomSheet';
import type {SubcategoryBottomSheetRef} from '@/components/common/SubcategoryBottomSheet/SubcategoryBottomSheet';
import type {VisitTypeBottomSheetRef} from '@/components/common/VisitTypeBottomSheet/VisitTypeBottomSheet';
import {setSelectedCompanion} from '@/features/companion';

type AddDocumentNavigationProp =
  NativeStackNavigationProp<DocumentStackParamList>;

export const AddDocumentScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<AddDocumentNavigationProp>();
  const dispatch = useDispatch<AppDispatch>();

  // Get companions from Redux
  const companions = useSelector(
    (state: RootState) => state.companion.companions,
  );
  const loading = useSelector((state: RootState) => state.documents.loading);

  // Get selected companion from Redux
  const selectedCompanionId = useSelector(
    (state: RootState) => state.companion.selectedCompanionId,
  );
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
  const deleteSheetRef = useRef<DeleteDocumentBottomSheetRef>(null);

  const handleCategoryChange = (newCategory: string | null) => {
    setCategory(newCategory);
    setSubcategory(null); // Reset subcategory when category changes
    if (errors.category) {
      setErrors(prev => ({...prev, category: ''}));
    }
  };

  const handleUploadDocuments = () => {
    uploadSheetRef.current?.open();
  };

  const handleTakePhoto = () => {
    // Mock implementation - In real app, use react-native-image-picker
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
    // Mock implementation
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
    // Mock implementation
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
    deleteSheetRef.current?.open();
  };

  const confirmDeleteFile = () => {
    if (fileToDelete) {
      setFiles(files.filter(f => f.id !== fileToDelete));
      setFileToDelete(null);
    }
  };

  const handleSave = async () => {
    // Reset errors
    const newErrors = {
      category: '',
      subcategory: '',
      title: '',
      businessName: '',
      issueDate: '',
      files: '',
    };

    // Validation
    let hasError = false;

    if (!category) {
      newErrors.category = 'Category missing';
      hasError = true;
    }
    if (!subcategory) {
      newErrors.subcategory = 'Sub category missing';
      hasError = true;
    }
    if (!title.trim()) {
      newErrors.title = 'Title is required';
      hasError = true;
    }
    if (!businessName.trim()) {
      newErrors.businessName = 'Business name is required';
      hasError = true;
    }
    if (hasIssueDate && !issueDate) {
      newErrors.issueDate = 'Issue date missing';
      hasError = true;
    }
    if (files.length === 0) {
      newErrors.files = 'Document missing';
      hasError = true;
    }

    if (hasError) {
      setErrors(newErrors);
      return;
    }

    try {
      console.log('[AddDocument] Starting document upload and save process');

      // Upload files to S3
      const uploadedFiles = await dispatch(uploadDocumentFiles(files)).unwrap();
      console.log('[AddDocument] Files uploaded successfully:', uploadedFiles.length);

      // Add document
      await dispatch(
        addDocument({
          companionId: selectedCompanionId!,
          category: category!,
          subcategory: subcategory!,
          visitType: visitType || 'general',
          title,
          businessName,
          issueDate: hasIssueDate ? issueDate.toISOString() : '',
          files: uploadedFiles,
          isSynced: false, // Category's sync status
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
      setErrors(prev => ({
        ...prev,
        files: error.message || 'Failed to add document. Please try again.',
      }));
    }
  };

  const getCategoryLabel = () => {
    if (!category) return 'Select category';
    return (
      category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')
    );
  };

  const getSubcategoryLabel = () => {
    if (!subcategory) return 'Select subcategory';
    return (
      subcategory.charAt(0).toUpperCase() +
      subcategory.slice(1).replace('-', ' ')
    );
  };

  const getVisitTypeLabel = () => {
    if (!visitType) return 'Select visit type';
    return visitType.charAt(0).toUpperCase() + visitType.slice(1);
  };

  return (
    <SafeArea>
      <Header
        title="Add document"
        showBackButton={true}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        <CompanionSelector
          companions={companions}
          selectedCompanionId={selectedCompanionId}
          onSelect={(id) => dispatch(setSelectedCompanion(id))}
          showAddButton={false}
          containerStyle={styles.companionSelector}
        />

        <View style={styles.noteContainer}>
          <Text style={styles.noteText}>
            <Text style={styles.noteLabel}>Note: </Text>
            <Text style={styles.noteMessage}>Health and Hygiene are synced with the PMS and cannot be modified after saving</Text>
          </Text>
        </View>

        <View>
          <TouchableOpacity onPress={() => categorySheetRef.current?.open()}>
            <Input
              label="Category"
              value={getCategoryLabel()}
              editable={false}
              pointerEvents="none"
              containerStyle={styles.input}
              icon={
                <Image source={Images.dropdownIcon} style={styles.dropdownIcon} />
              }
            />
          </TouchableOpacity>
          {errors.category ? <Text style={styles.errorText}>{errors.category}</Text> : null}
        </View>

        <View>
          <TouchableOpacity
            onPress={() => subcategorySheetRef.current?.open()}
            disabled={!category}>
            <Input
              label="Sub category"
              value={getSubcategoryLabel()}
              editable={false}
              pointerEvents="none"
              containerStyle={styles.input}
              icon={
                <Image source={Images.dropdownIcon} style={styles.dropdownIcon} />
              }
            />
          </TouchableOpacity>
          {errors.subcategory ? <Text style={styles.errorText}>{errors.subcategory}</Text> : null}
        </View>

        <TouchableOpacity onPress={() => visitTypeSheetRef.current?.open()}>
          <Input
            label="Visit type"
            value={getVisitTypeLabel()}
            editable={false}
            pointerEvents="none"
            containerStyle={styles.input}
            icon={
              <Image source={Images.dropdownIcon} style={styles.dropdownIcon} />
            }
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
              <View
                style={[
                  styles.toggleTrack,
                  hasIssueDate && styles.toggleTrackActive,
                ]}>
                <View
                  style={[
                    styles.toggleThumb,
                    hasIssueDate && styles.toggleThumbActive,
                  ]}
                />
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

        <View>
          {files.length === 0 ? (
            <>
              <TouchableOpacity
                style={[styles.uploadSection, errors.files && styles.uploadSectionError]}
                onPress={handleUploadDocuments}
                activeOpacity={0.7}>
                <Image source={Images.uploadIcon} style={styles.uploadIcon} />
                <Text style={styles.uploadTitle}>Upload documents</Text>
                <Text style={styles.uploadSubtitle}>
                  Only DOC, PDF, PNG, JPEG formats{'\n'}with max size 5 MB
                </Text>
              </TouchableOpacity>
              {errors.files ? <Text style={styles.errorText}>{errors.files}</Text> : null}
            </>
          ) : (
            <View style={styles.filesPreviewContainer}>
              <View style={styles.multipleFilesGrid}>
                {files.map(file => (
                  <View key={file.id} style={styles.filePreviewBox}>
                    <Image
                      source={{uri: file.uri}}
                      style={styles.filePreviewImage}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      style={styles.removeButtonMultiple}
                      onPress={() => handleRemoveFile(file.id)}>
                      <Image source={Images.closeIcon} style={styles.removeIconSmall} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.addMoreBox}
                  onPress={handleUploadDocuments}>
                  <Image source={Images.addIconWhite} style={styles.addMoreIcon} />
                </TouchableOpacity>
              </View>
              {errors.files ? <Text style={styles.errorText}>{errors.files}</Text> : null}
            </View>
          )}
        </View>

        <View style={styles.saveButton}>
          <LiquidGlassButton
            title={loading ? 'Saving...' : 'Save'}
            onPress={handleSave}
            style={styles.button}
            textStyle={styles.buttonText}
            tintColor={theme.colors.secondary}
            shadowIntensity="medium"
            forceBorder
            borderColor={theme.colors.borderMuted}
            height={56}
            borderRadius={16}
            loading={loading}
            disabled={loading}
          />
        </View>
      </ScrollView>

      <SimpleDatePicker
        value={issueDate}
        onDateChange={date => {
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
        onSave={handleCategoryChange}
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
        ref={deleteSheetRef}
        documentTitle={fileToDelete ? files.find(f => f.id === fileToDelete)?.name : 'this file'}
        onDelete={confirmDeleteFile}
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
    uploadSection: {
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: theme.colors.borderMuted,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing[8],
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing[4],
      backgroundColor: theme.colors.surface,
    },
    uploadIcon: {
      width: 48,
      height: 48,
      resizeMode: 'contain',
      marginBottom: theme.spacing[3],
      tintColor: theme.colors.primary,
    },
    uploadTitle: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[1],
    },
    uploadSubtitle: {
      ...theme.typography.labelXsBold,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 16,
    },
    filesSection: {
      marginBottom: theme.spacing[4],
    },
    filesSectionTitle: {
      ...theme.typography.labelMdBold,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[2],
    },
    fileItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing[3],
      paddingHorizontal: theme.spacing[4],
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 2,
      borderColor: theme.colors.borderMuted,
      marginBottom: theme.spacing[2],
    },
    fileName: {
      ...theme.typography.bodyMedium,
      color: theme.colors.secondary,
      flex: 1,
      marginRight: theme.spacing[2],
    },
    removeIcon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
    },
    saveButton: {
      marginTop: theme.spacing[4],
    },
    button: {
      width: '100%',
      backgroundColor: theme.colors.secondary,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
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
    uploadSectionError: {
      borderColor: theme.colors.error,
    },
    filesPreviewContainer: {
      marginBottom: theme.spacing[4],
    },
    singleFilePreview: {
      width: '100%',
      height: 250,
      borderRadius: theme.borderRadius.lg,
      overflow: 'hidden',
      position: 'relative',
    },
    singleFileImage: {
      width: '100%',
      height: '100%',
    },
    removeButtonSingle: {
      position: 'absolute',
      top: theme.spacing[3],
      right: theme.spacing[3],
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeIconLarge: {
      width: 20,
      height: 20,
      tintColor: theme.colors.white,
    },
    multipleFilesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing[3],
    },
    filePreviewBox: {
      width: '47%',
      height: 120,
      borderRadius: theme.borderRadius.lg,
       borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      overflow: 'hidden',
      position: 'relative',
    },
    filePreviewImage: {
      width: '100%',
      height: '100%',
    },
    removeButtonMultiple: {
      position: 'absolute',
      top: theme.spacing[2],
      right: theme.spacing[2],
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeIconSmall: {
      width: 25,
      height: 25,
    },
    addMoreBox: {
      width: '47%',
      height: 120,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: theme.colors.borderMuted,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    addMoreIcon: {
      width: 32,
      height: 32,
      tintColor: theme.colors.textSecondary,
    },
    noteContainer: {
      marginBottom: theme.spacing[6],
      paddingHorizontal: theme.spacing[2],
    },
    noteText: {
      ...theme.typography.labelXsBold,
      textAlign: 'justify',
    },
    noteLabel: {
      color: theme.colors.primary,
    },
    noteMessage: {
      color: theme.colors.placeholder,
    },
  });
