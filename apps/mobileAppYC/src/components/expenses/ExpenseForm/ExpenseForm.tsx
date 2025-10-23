import React, {useMemo, useState} from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useTheme, useFormBottomSheets, useFileOperations} from '@/hooks';
import {CompanionSelector} from '@/components/common/CompanionSelector/CompanionSelector';
import {CategoryBottomSheet} from '@/components/common/CategoryBottomSheet/CategoryBottomSheet';
import {SubcategoryBottomSheet} from '@/components/common/SubcategoryBottomSheet/SubcategoryBottomSheet';
import {VisitTypeBottomSheet} from '@/components/common/VisitTypeBottomSheet/VisitTypeBottomSheet';
import {TouchableInput} from '@/components/common/TouchableInput/TouchableInput';
import {Input} from '@/components/common';
import LiquidGlassButton from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import {
  SimpleDatePicker,
  formatDateForDisplay,
} from '@/components/common/SimpleDatePicker/SimpleDatePicker';
import {UploadDocumentBottomSheet} from '@/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet';
import {DeleteDocumentBottomSheet} from '@/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet';
import {DocumentAttachmentsSection} from '@/components/documents/DocumentAttachmentsSection';
import {Images} from '@/assets/images';
import type {Companion} from '@/features/companion/types';
import type {ExpenseAttachment} from '@/features/expenses';
import {resolveCurrencySymbol} from '@/utils/currency';
import {
  resolveCategoryLabel,
  resolveSubcategoryLabel,
  resolveVisitTypeLabel,
} from '@/utils/expenseLabels';

export interface ExpenseFormData {
  category: string | null;
  subcategory: string | null;
  visitType: string | null;
  title: string;
  date: Date | null;
  amount: string;
  attachments: ExpenseAttachment[];
  providerName?: string;
}

export interface ExpenseFormErrors {
  category?: string;
  subcategory?: string;
  visitType?: string;
  title?: string;
  date?: string;
  amount?: string;
  attachments?: string;
}

export interface ExpenseFormProps {
  companions: Companion[];
  selectedCompanionId: string | null;
  onCompanionSelect: (id: string | null) => void;
  formData: ExpenseFormData;
  onFormChange: <K extends keyof ExpenseFormData>(field: K, value: ExpenseFormData[K]) => void;
  errors: ExpenseFormErrors;
  onErrorClear: (field: keyof ExpenseFormErrors) => void;
  loading: boolean;
  onSave: () => void;
  currencyCode: string;
  saveButtonText?: string;
  showProviderField?: boolean;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  companions,
  selectedCompanionId,
  onCompanionSelect,
  formData,
  onFormChange,
  errors,
  onErrorClear,
  loading,
  onSave,
  currencyCode,
  saveButtonText = 'Save',
  showProviderField = true,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const {refs, openSheet, closeSheet} = useFormBottomSheets();
  const {categorySheetRef, subcategorySheetRef, visitTypeSheetRef, uploadSheetRef, deleteSheetRef} = refs;

  const currencySymbol = resolveCurrencySymbol(currencyCode, '$');

  const {
    fileToDelete,
    handleTakePhoto,
    handleChooseFromGallery,
    handleUploadFromDrive,
    handleRemoveFile,
    confirmDeleteFile,
  } = useFileOperations({
    files: formData.attachments,
    setFiles: files => onFormChange('attachments', files),
    clearError: () => onErrorClear('attachments'),
    openSheet,
    closeSheet,
    deleteSheetRef,
  });

  const displayDate = formData.date
    ? formatDateForDisplay(formData.date)
    : 'Select date';
  const categoryValue = formData.category
    ? resolveCategoryLabel(formData.category)
    : undefined;
  const subcategoryValue =
    formData.category && formData.subcategory
      ? resolveSubcategoryLabel(formData.category, formData.subcategory)
      : undefined;
  const visitTypeValue = formData.visitType
    ? resolveVisitTypeLabel(formData.visitType)
    : undefined;

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

        <View style={styles.fieldGroup}>
          <TouchableInput
            label={formData.category ? 'Category' : undefined}
            value={categoryValue}
            placeholder="Category"
            onPress={() => {
              openSheet('category');
              categorySheetRef.current?.open();
            }}
            rightComponent={<Image source={Images.dropdownIcon} style={styles.dropdownIcon} />}
            error={errors.category}
          />
        </View>

        <View style={styles.fieldGroup}>
          <TouchableInput
            label={formData.subcategory ? 'Sub category' : undefined}
            value={subcategoryValue}
            placeholder="Sub category"
            onPress={() => {
              if (formData.category) {
                openSheet('subcategory');
                subcategorySheetRef.current?.open();
              }
            }}
            rightComponent={<Image source={Images.dropdownIcon} style={styles.dropdownIcon} />}
            error={errors.subcategory}
            disabled={!formData.category}
          />
        </View>

        <View style={styles.fieldGroup}>
          <TouchableInput
            label={formData.visitType ? 'Visit type' : undefined}
            value={visitTypeValue}
            placeholder="Visit type"
            onPress={() => {
              openSheet('visitType');
              visitTypeSheetRef.current?.open();
            }}
            rightComponent={<Image source={Images.dropdownIcon} style={styles.dropdownIcon} />}
            error={errors.visitType}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Input
            label="Expense name"
            value={formData.title}
            onChangeText={text => {
              onFormChange('title', text);
              onErrorClear('title');
            }}
            error={errors.title}
          />
        </View>

        {showProviderField && (
          <View style={styles.fieldGroup}>
            <Input
              label="Provider / Business"
              value={formData.providerName ?? ''}
              onChangeText={text => onFormChange('providerName', text)}
            />
          </View>
        )}

        <View style={styles.fieldGroup}>
          <TouchableInput
            label={formData.date ? 'Date' : undefined}
            value={formData.date ? displayDate : undefined}
            placeholder="Date"
            onPress={() => setShowDatePicker(true)}
            rightComponent={<Image source={Images.calendarIcon} style={styles.calendarIcon} />}
            error={errors.date}
          />
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.amountInputWrapper}>
            <Input
              label="Amount"
              value={formData.amount}
              onChangeText={text => {
                const sanitized = text.replaceAll(/[^0-9.]/g, '');
                onFormChange('amount', sanitized);
                onErrorClear('amount');
              }}
              keyboardType="numeric"
              containerStyle={styles.amountInputContainer}
              inputStyle={styles.amountInput}
              placeholderOffset={theme.spacing[4]}
              error={errors.amount}
            />
            <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <DocumentAttachmentsSection
            files={formData.attachments}
            onAddPress={() => {
              openSheet('upload');
              uploadSheetRef.current?.open();
            }}
            onRequestRemove={file => handleRemoveFile(file.id)}
            error={errors.attachments}
            emptyTitle="Upload documents"
            emptySubtitle="Only DOC, PDF, PNG, JPEG formats with max size 5 MB"
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <LiquidGlassButton
          title={loading ? 'Saving...' : saveButtonText}
          onPress={onSave}
          loading={loading}
          disabled={loading}
          style={styles.saveButton}
          textStyle={styles.saveButtonText}
          tintColor={theme.colors.secondary}
          forceBorder
          borderColor={theme.colors.borderMuted}
          shadowIntensity="medium"
          height={56}
          borderRadius={16}
        />
      </View>

      <SimpleDatePicker
        show={showDatePicker}
        value={formData.date}
        onDateChange={(selectedDate: Date) => {
          onFormChange('date', selectedDate);
          onErrorClear('date');
        }}
        onDismiss={() => setShowDatePicker(false)}
      />

      <CategoryBottomSheet
        ref={categorySheetRef}
        selectedCategory={formData.category}
        onSave={(category: string | null) => {
          onFormChange('category', category);
          onFormChange('subcategory', null);
          onErrorClear('category');
          closeSheet();
        }}
      />

      <SubcategoryBottomSheet
        ref={subcategorySheetRef}
        category={formData.category}
        selectedSubcategory={formData.subcategory}
        onSave={(subcategory: string | null) => {
          onFormChange('subcategory', subcategory);
          onErrorClear('subcategory');
          closeSheet();
        }}
      />

      <VisitTypeBottomSheet
        ref={visitTypeSheetRef}
        selectedVisitType={formData.visitType}
        onSave={(visitType: string | null) => {
          onFormChange('visitType', visitType);
          onErrorClear('visitType');
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
            ? formData.attachments.find(f => f.id === fileToDelete)?.name
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
      marginBottom: theme.spacing[4],
    },
    fieldGroup: {
      marginBottom: theme.spacing[4],
    },
    dropdownIcon: {
      width: 16,
      height: 16,
      resizeMode: 'contain',
    },
    calendarIcon: {
      width: 18,
      height: 18,
      resizeMode: 'contain',
    },
    amountInputWrapper: {
      position: 'relative',
      width: '100%',
    },
    amountInputContainer: {
      marginBottom: 0,
    },
    currencyPrefix: {
      position: 'absolute',
      left: theme.spacing[5],
      top: 16,
      ...theme.typography.label,
      color: theme.colors.secondary,
      zIndex: 1,
      pointerEvents: 'none',
    },
    amountInput: {
      paddingLeft: theme.spacing[4],
      color: theme.colors.secondary,
    },
    footer: {
      paddingHorizontal: theme.spacing[4],
      paddingBottom: theme.spacing[6],
      paddingTop: theme.spacing[2],
      backgroundColor: theme.colors.background,
    },
    saveButton: {
      width: '100%',
      marginTop: theme.spacing[4],
    },
    saveButtonText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.white,
    },
  });

export default ExpenseForm;
