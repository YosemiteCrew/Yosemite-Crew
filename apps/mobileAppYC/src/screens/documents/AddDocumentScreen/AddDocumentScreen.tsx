import React, {useState, useRef, useMemo} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeArea, Input, Button} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {CompanionSelector} from '@/components/common/CompanionSelector/CompanionSelector';
import {SimpleDatePicker} from '@/components/common/SimpleDatePicker/SimpleDatePicker';
import {CategoryBottomSheet} from '@/components/common/CategoryBottomSheet/CategoryBottomSheet';
import {SubcategoryBottomSheet} from '@/components/common/SubcategoryBottomSheet/SubcategoryBottomSheet';
import {VisitTypeBottomSheet} from '@/components/common/VisitTypeBottomSheet/VisitTypeBottomSheet';
import {useTheme} from '@/hooks';
import {useSelector, useDispatch} from 'react-redux';
import type {RootState, AppDispatch} from '@/app/store';
import type {DocumentStackParamList} from '@/navigation/types';
import type {DocumentFile} from '@/types/document.types';
import {addDocument, uploadDocumentFiles} from '@/features/documents/documentSlice';
import {Images} from '@/assets/images';
import type {CategoryBottomSheetRef} from '@/components/common/CategoryBottomSheet/CategoryBottomSheet';
import type {SubcategoryBottomSheetRef} from '@/components/common/SubcategoryBottomSheet/SubcategoryBottomSheet';
import type {VisitTypeBottomSheetRef} from '@/components/common/VisitTypeBottomSheet/VisitTypeBottomSheet';

type AddDocumentNavigationProp = NativeStackNavigationProp<DocumentStackParamList>;

export const AddDocumentScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<AddDocumentNavigationProp>();
  const dispatch = useDispatch<AppDispatch>();

  // Get companions from Redux
  const companions = useSelector((state: RootState) => state.companion.companions);
  const loading = useSelector((state: RootState) => state.documents.loading);

  // Form state
  const [selectedCompanionId, setSelectedCompanionId] = useState<string | null>(
    companions.length > 0 ? companions[0].id : null,
  );
  const [category, setCategory] = useState<string | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [visitType, setVisitType] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [hasIssueDate, setHasIssueDate] = useState(true);
  const [issueDate, setIssueDate] = useState(new Date());
  const [files, setFiles] = useState<DocumentFile[]>([]);

  // Bottom sheet refs
  const categorySheetRef = useRef<CategoryBottomSheetRef>(null);
  const subcategorySheetRef = useRef<SubcategoryBottomSheetRef>(null);
  const visitTypeSheetRef = useRef<VisitTypeBottomSheetRef>(null);

  const handleCategoryChange = (newCategory: string | null) => {
    setCategory(newCategory);
    setSubcategory(null); // Reset subcategory when category changes
  };

  const handleUploadDocuments = () => {
    Alert.alert(
      'Upload documents',
      'Choose upload method',
      [
        {
          text: 'Take Photo',
          onPress: () => handleTakePhoto(),
        },
        {
          text: 'Choose from Gallery',
          onPress: () => handleChooseFromGallery(),
        },
        {
          text: 'Upload from Drive',
          onPress: () => handleUploadFromDrive(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      {cancelable: true},
    );
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
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles(files.filter(f => f.id !== fileId));
  };

  const handleSave = async () => {
    // Validation
    if (!selectedCompanionId) {
      Alert.alert('Error', 'Please select a companion');
      return;
    }
    if (!category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }
    if (!subcategory) {
      Alert.alert('Error', 'Please select a subcategory');
      return;
    }
    if (!visitType) {
      Alert.alert('Error', 'Please select a visit type');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }
    if (!businessName.trim()) {
      Alert.alert('Error', 'Please enter a business name');
      return;
    }
    if (files.length === 0) {
      Alert.alert('Error', 'Please upload at least one document');
      return;
    }

    try {
      // Upload files to S3
      const uploadedFiles = await dispatch(uploadDocumentFiles(files)).unwrap();

      // Add document
      await dispatch(
        addDocument({
          companionId: selectedCompanionId,
          category,
          subcategory,
          visitType,
          title,
          businessName,
          issueDate: hasIssueDate ? issueDate.toISOString() : '',
          files: uploadedFiles,
          isSynced: false,
        }),
      ).unwrap();

      Alert.alert('Success', 'Document added successfully', [
        {text: 'OK', onPress: () => navigation.goBack()},
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add document');
    }
  };

  const getCategoryLabel = () => {
    if (!category) return 'Select category';
    return category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ');
  };

  const getSubcategoryLabel = () => {
    if (!subcategory) return 'Select subcategory';
    return subcategory.charAt(0).toUpperCase() + subcategory.slice(1).replace('-', ' ');
  };

  const getVisitTypeLabel = () => {
    if (!visitType) return 'Select visit type';
    return visitType.charAt(0).toUpperCase() + visitType.slice(1);
  };

  return (
    <SafeArea>
      <Header title="Add document" showBackButton={true} onBack={() => navigation.goBack()} />
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
            value={getCategoryLabel()}
            editable={false}
            pointerEvents="none"
            containerStyle={styles.input}
            icon={<Image source={Images.dropdownIcon} style={styles.dropdownIcon} />}
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => subcategorySheetRef.current?.open()} disabled={!category}>
          <Input
            label="Sub category"
            value={getSubcategoryLabel()}
            editable={false}
            pointerEvents="none"
            containerStyle={styles.input}
            icon={<Image source={Images.dropdownIcon} style={styles.dropdownIcon} />}
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => visitTypeSheetRef.current?.open()}>
          <Input
            label="Visit type"
            value={getVisitTypeLabel()}
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
          placeholder="Enter title"
          containerStyle={styles.input}
        />

        <Input
          label="Issuing business name"
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="Enter business name"
          containerStyle={styles.input}
        />

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
            <SimpleDatePicker
              value={issueDate}
              onDateChange={setIssueDate}
              show={true}
              onDismiss={() => {}}
            />
          )}
        </View>

        <TouchableOpacity
          style={styles.uploadSection}
          onPress={handleUploadDocuments}
          activeOpacity={0.7}>
          <Image source={Images.uploadIcon} style={styles.uploadIcon} />
          <Text style={styles.uploadTitle}>Upload documents</Text>
          <Text style={styles.uploadSubtitle}>
            Only DOC, PDF, PNG, JPEG formats{'\n'}with max size 5 MB
          </Text>
        </TouchableOpacity>

        {files.length > 0 && (
          <View style={styles.filesSection}>
            <Text style={styles.filesSectionTitle}>Uploaded Documents</Text>
            {files.map(file => (
              <View key={file.id} style={styles.fileItem}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {file.name}
                </Text>
                <TouchableOpacity onPress={() => handleRemoveFile(file.id)}>
                  <Image source={Images.closeIcon} style={styles.removeIcon} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.saveButton}>
          <Button
            title="Save"
            onPress={handleSave}
            disabled={loading}
          />
        </View>
      </ScrollView>

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
      borderRadius: theme.borderRadius.base,
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
      tintColor: theme.colors.error,
    },
    saveButton: {
      marginTop: theme.spacing[4],
    },
  });
