import React, {useState, useRef, useMemo, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
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

  // Bottom sheet refs
  const categorySheetRef = useRef<CategoryBottomSheetRef>(null);
  const subcategorySheetRef = useRef<SubcategoryBottomSheetRef>(null);
  const visitTypeSheetRef = useRef<VisitTypeBottomSheetRef>(null);

  // Load document data
  useEffect(() => {
    if (document) {
      setSelectedCompanionId(document.companionId);
      setCategory(document.category);
      setSubcategory(document.subcategory);
      setVisitType(document.visitType);
      setTitle(document.title);
      setBusinessName(document.businessName);
      setHasIssueDate(!!document.issueDate);
      setIssueDate(document.issueDate ? new Date(document.issueDate) : new Date());
      setFiles(document.files);
    }
  }, [document]);

  if (!document) {
    return (
      <SafeArea>
        <Header title="Edit document" showBackButton={true} onBack={() => navigation.goBack()} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Document not found</Text>
        </View>
      </SafeArea>
    );
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete file',
      'Are you sure you want to delete the file blood report ?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(deleteDocument(documentId)).unwrap();
              Alert.alert('Success', 'Document deleted successfully', [
                {text: 'OK', onPress: () => navigation.navigate('DocumentsMain')},
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete document');
            }
          },
        },
      ],
    );
  };

  const handleSave = async () => {
    // Validation
    if (!category || !subcategory || !visitType || !title.trim() || !businessName.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      // Upload any new files
      const newFiles = files.filter(f => !f.s3Url);
      let uploadedFiles = files.filter(f => f.s3Url);

      if (newFiles.length > 0) {
        const uploaded = await dispatch(uploadDocumentFiles(newFiles)).unwrap();
        uploadedFiles = [...uploadedFiles, ...uploaded];
      }

      await dispatch(
        updateDocument({
          documentId,
          updates: {
            category,
            subcategory,
            visitType,
            title,
            businessName,
            issueDate: hasIssueDate ? issueDate.toISOString() : '',
            files: uploadedFiles,
          },
        }),
      ).unwrap();

      Alert.alert('Success', 'Document updated successfully', [
        {text: 'OK', onPress: () => navigation.goBack()},
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update document');
    }
  };

  const handleUploadDocuments = () => {
    // Mock adding a new file
    const mockFile: DocumentFile = {
      id: `file_${Date.now()}`,
      uri: 'file://mock-new-file.jpg',
      name: 'new-document.jpg',
      type: 'image/jpeg',
      size: 1024000,
    };
    setFiles([...files, mockFile]);
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles(files.filter(f => f.id !== fileId));
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
          onSelect={setSelectedCompanionId}
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

        <Input
          label="Title"
          value={title}
          onChangeText={setTitle}
          containerStyle={styles.input}
        />

        <Input
          label="Issuing business name"
          value={businessName}
          onChangeText={setBusinessName}
          containerStyle={styles.input}
        />

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

        <Text style={styles.uploadedTitle}>Uploaded Documents</Text>
        {files.map(file => (
          <View key={file.id} style={styles.fileItem}>
            <Image source={Images.documentIcon} style={styles.fileIcon} />
            <Text style={styles.fileName} numberOfLines={1}>
              {file.name}
            </Text>
            <TouchableOpacity onPress={() => handleRemoveFile(file.id)}>
              <Image source={Images.closeIcon} style={styles.removeIcon} />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addFileButton} onPress={handleUploadDocuments}>
          <Image source={Images.blueAddIcon} style={styles.addFileIcon} />
        </TouchableOpacity>

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
      paddingBottom: theme.spacing[6],
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorText: {
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
    uploadedTitle: {
      ...theme.typography.labelMdBold,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[3],
    },
    fileItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing[3],
      paddingHorizontal: theme.spacing[4],
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.base,
      marginBottom: theme.spacing[2],
    },
    fileIcon: {
      width: 32,
      height: 32,
      resizeMode: 'contain',
      marginRight: theme.spacing[3],
    },
    fileName: {
      ...theme.typography.bodyMedium,
      color: theme.colors.secondary,
      flex: 1,
    },
    removeIcon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
      tintColor: theme.colors.error,
    },
    addFileButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginVertical: theme.spacing[4],
    },
    addFileIcon: {
      width: 24,
      height: 24,
      resizeMode: 'contain',
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
  });
