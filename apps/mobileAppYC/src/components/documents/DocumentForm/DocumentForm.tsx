/* istanbul ignore file -- shared document form UI component */
import React, {useMemo} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Switch,
} from 'react-native';
import {Input} from '@/components/common';
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
import {UploadDocumentBottomSheet} from '@/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet';
import {DeleteDocumentBottomSheet} from '@/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet';
import {DocumentAttachmentsSection} from '@/components/documents/DocumentAttachmentsSection';
import {useTheme, useFormBottomSheets, useFileOperations} from '@/hooks';
import {formatLabel} from '@/utils/helpers';
import {Images} from '@/assets/images';
import type {DocumentFile} from '@/types/document.types';
import type {Companion} from '@/features/companion/types';

export interface DocumentFormData {
  category: string | null;
  subcategory: string | null;
  visitType: string | null;
  title: string;
  businessName: string;
  hasIssueDate: boolean;
  issueDate: Date;
  files: DocumentFile[];
}

export interface DocumentFormErrors {
  category: string;
  subcategory: string;
  title: string;
  businessName: string;
  issueDate: string;
  files: string;
}

export interface DocumentFormProps {
  companions: Companion[];
  selectedCompanionId: string | null;
  onCompanionSelect: (id: string | null) => void;
  formData: DocumentFormData;
  onFormChange: (field: keyof DocumentFormData, value: any) => void;
  errors: DocumentFormErrors;
  onErrorClear: (field: keyof DocumentFormErrors) => void;
  loading: boolean;
  onSave: () => void;
  saveButtonText?: string;
  showNote?: boolean;
}

export const DocumentForm: React.FC<DocumentFormProps> = ({
  companions,
  selectedCompanionId,
  onCompanionSelect,
  formData,
  onFormChange,
  errors,
  onErrorClear,
  loading,
  onSave,
  saveButtonText = 'Save',
  showNote = false,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [showDatePicker, setShowDatePicker] = React.useState(false);

  const {refs, openSheet, closeSheet} = useFormBottomSheets();
  const {categorySheetRef, subcategorySheetRef, visitTypeSheetRef, uploadSheetRef, deleteSheetRef} = refs;

  const {
    fileToDelete,
    handleTakePhoto,
    handleChooseFromGallery,
    handleUploadFromDrive,
    handleRemoveFile,
    confirmDeleteFile,
  } = useFileOperations({
    files: formData.files,
    setFiles: files => onFormChange('files', files),
    clearError: () => onErrorClear('files'),
    openSheet,
    closeSheet,
    deleteSheetRef,
  });

  const handleCategoryChange = (newCategory: string | null) => {
    onFormChange('category', newCategory);
    onFormChange('subcategory', null);
    onErrorClear('category');
    closeSheet();
  };

  const handleUploadDocuments = () => {
    openSheet('upload');
    uploadSheetRef.current?.open();
  };

  const getCategoryLabel = () => formatLabel(formData.category, 'Select category');
  const getSubcategoryLabel = () => formatLabel(formData.subcategory, 'Select subcategory');
  const getVisitTypeLabel = () => formatLabel(formData.visitType, 'Select visit type');

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        <CompanionSelector
          companions={companions}
          selectedCompanionId={selectedCompanionId}
          onSelect={onCompanionSelect}
          showAddButton={false}
          containerStyle={styles.companionSelector}
        />

        {showNote && (
          <View style={styles.noteContainer}>
            <Text style={styles.noteText}>
              <Text style={styles.noteLabel}>Note: </Text>
              <Text style={styles.noteMessage}>
                Health and Hygiene are synced with the PMS and cannot be modified after saving
              </Text>
            </Text>
          </View>
        )}

        <View>
          <TouchableOpacity onPress={() => {
            openSheet('category');
            categorySheetRef.current?.open();
          }}>
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
          {errors.category ? (
            <Text style={styles.errorText}>{errors.category}</Text>
          ) : null}
        </View>

        <View>
          <TouchableOpacity
            onPress={() => {
              if (formData.category) {
                openSheet('subcategory');
                subcategorySheetRef.current?.open();
              }
            }}
            disabled={!formData.category}>
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
          {errors.subcategory ? (
            <Text style={styles.errorText}>{errors.subcategory}</Text>
          ) : null}
        </View>

        <TouchableOpacity onPress={() => {
          openSheet('visitType');
          visitTypeSheetRef.current?.open();
        }}>
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
            value={formData.title}
            onChangeText={(text) => {
              onFormChange('title', text);
              onErrorClear('title');
            }}
            containerStyle={styles.input}
          />
          {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}
        </View>

        <View>
          <Input
            label="Issuing business name"
            value={formData.businessName}
            onChangeText={(text) => {
              onFormChange('businessName', text);
              onErrorClear('businessName');
            }}
            containerStyle={styles.input}
          />
          {errors.businessName ? (
            <Text style={styles.errorText}>{errors.businessName}</Text>
          ) : null}
        </View>

        <View style={styles.dateSection}>
          <View style={styles.dateSectionHeader}>
            <Text style={styles.label}>Issue date</Text>
            <Switch
              value={formData.hasIssueDate}
              onValueChange={value => onFormChange('hasIssueDate', value)}
              trackColor={{false: theme.colors.borderMuted, true: theme.colors.primary}}
              thumbColor={theme.colors.white}
            />
          </View>

          {formData.hasIssueDate && (
            <TouchableInput
              label=""
              value={formatDateForDisplay(formData.issueDate)}
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
          files={formData.files}
          onAddPress={handleUploadDocuments}
          onRequestRemove={file => handleRemoveFile(file.id)}
          error={errors.files}
        />

        <View style={styles.saveButton}>
          <LiquidGlassButton
            title={loading ? 'Saving...' : saveButtonText}
            onPress={onSave}
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
        value={formData.issueDate}
        onDateChange={date => {
          onFormChange('issueDate', date);
          setShowDatePicker(false);
        }}
        show={showDatePicker}
        onDismiss={() => setShowDatePicker(false)}
        maximumDate={new Date()}
        mode="date"
      />

      <CategoryBottomSheet
        ref={categorySheetRef}
        selectedCategory={formData.category}
        onSave={handleCategoryChange}
      />

      <SubcategoryBottomSheet
        ref={subcategorySheetRef}
        category={formData.category}
        selectedSubcategory={formData.subcategory}
        onSave={(value) => {
          onFormChange('subcategory', value);
          closeSheet();
        }}
      />

      <VisitTypeBottomSheet
        ref={visitTypeSheetRef}
        selectedVisitType={formData.visitType}
        onSave={(value) => {
          onFormChange('visitType', value);
          closeSheet();
        }}
      />

      <UploadDocumentBottomSheet
        ref={uploadSheetRef}
        onTakePhoto={() => {
          handleTakePhoto();
          closeSheet();
        }}
        onChooseGallery={() => {
          handleChooseFromGallery();
          closeSheet();
        }}
        onUploadDrive={() => {
          handleUploadFromDrive();
          closeSheet();
        }}
      />

      <DeleteDocumentBottomSheet
        ref={deleteSheetRef}
        documentTitle={
          fileToDelete
            ? formData.files.find(f => f.id === fileToDelete)?.name
            : 'this file'
        }
        onDelete={confirmDeleteFile}
      />
    </>
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
      paddingBottom: theme.spacing[24],
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
