import React, {useMemo, useState} from 'react';
import {View, StyleSheet, Text, Image} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme, useFormBottomSheets} from '@/hooks';
import {Input} from '@/shared/components/common';
import AERLayout from '@/features/adverseEventReporting/components/AERLayout';
import {
  SimpleDatePicker,
  formatDateForDisplay,
} from '@/shared/components/common/SimpleDatePicker/SimpleDatePicker';
import {TouchableInput} from '@/shared/components/common/TouchableInput/TouchableInput';
import {Images} from '@/assets/images';
import type {AdverseEventStackParamList} from '@/navigation/types';
import {Checkbox} from '@/shared/components/common/Checkbox/Checkbox';
import {DocumentAttachmentsSection} from '@/features/documents/components/DocumentAttachmentsSection';
import {
  type UploadDocumentBottomSheetRef,
} from '@/shared/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet';
import {
  type DeleteDocumentBottomSheetRef,
} from '@/shared/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet';
import UploadDeleteSheets from '@/shared/components/common/UploadDeleteSheets/UploadDeleteSheets';
import {useFileOperations} from '@/shared/hooks/useFileOperations';
import {CountryBottomSheet, type CountryBottomSheetRef} from '@/shared/components/common/CountryBottomSheet/CountryBottomSheet';
import COUNTRIES from '@/shared/utils/countryList.json';
import {AdministrationMethodBottomSheet, type AdministrationMethodBottomSheetRef} from '@/shared/components/common/AdministrationMethodBottomSheet/AdministrationMethodBottomSheet';
import type {DocumentFile} from '@/features/documents/types';
import {createCommonFormStyles} from '@/shared/styles/commonFormStyles';

type Step5FormData = {
  productName: string;
  brandName: string;
  manufacturingCountry: null | {
    name: string;
    code: string;
    flag: string;
    dial_code: string;
  };
  batchNumber: string;
  frequencyUsed: string;
  quantityUsed: string;
  quantityUnit: 'tablet' | 'liquid';
  administrationMethod:
    | null
    | 'none'
    | 'by mouth'
    | 'on the skin'
    | 'subcutaneous injection'
    | 'intramuscular injection'
    | 'into the ear'
    | 'into the eye'
    | 'other';
  reasonToUseProduct: string;
  petConditionBefore: string;
  petConditionAfter: string;
  eventDate: Date;
  files: DocumentFile[];
};

type Step5FormErrors = {
  productName: string;
  brandName: string;
  manufacturingCountry: string;
  batchNumber: string;
  frequencyUsed: string;
  quantityUsed: string;
  administrationMethod: string;
  reasonToUseProduct: string;
  petConditionBefore: string;
  petConditionAfter: string;
  files: string;
};

const createInitialErrors = (): Step5FormErrors => ({
  productName: '',
  brandName: '',
  manufacturingCountry: '',
  batchNumber: '',
  frequencyUsed: '',
  quantityUsed: '',
  administrationMethod: '',
  reasonToUseProduct: '',
  petConditionBefore: '',
  petConditionAfter: '',
  files: '',
});

type Props = NativeStackScreenProps<AdverseEventStackParamList, 'Step5'>;

export const Step5Screen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const common = useMemo(() => createCommonFormStyles(theme), [theme]);

  const [formData, setFormData] = useState<Step5FormData>({
    productName: '',
    brandName: '',
    manufacturingCountry: null,
    batchNumber: '',
    frequencyUsed: '',
    quantityUsed: '',
    quantityUnit: 'tablet',
    administrationMethod: null,
    reasonToUseProduct: '',
    petConditionBefore: '',
    petConditionAfter: '',
    eventDate: new Date(),
    files: [],
  });
  const [formErrors, setFormErrors] = useState<Step5FormErrors>(() =>
    createInitialErrors(),
  );

  const [showDatePicker, setShowDatePicker] = useState(false);

  const {refs, openSheet, closeSheet, registerSheet} = useFormBottomSheets();
  const {uploadSheetRef, deleteSheetRef} = refs as unknown as {
    uploadSheetRef: React.RefObject<UploadDocumentBottomSheetRef>;
    deleteSheetRef: React.RefObject<DeleteDocumentBottomSheetRef>;
  };
  // These two sheets are local to AER step and are not part of generic form sheets
  const countrySheetRef = React.useRef<CountryBottomSheetRef>(null);
  const adminSheetRef = React.useRef<AdministrationMethodBottomSheetRef>(null);

  React.useEffect(() => {
    registerSheet('country', countrySheetRef as any);
    registerSheet('admin', adminSheetRef as any);
  }, [registerSheet]);

  // File operations (reuse same handlers as Documents flow)
  const clearFieldError = (field: keyof Step5FormErrors) => {
    setFormErrors(prev => {
      if (!prev[field]) {
        return prev;
      }
      return {...prev, [field]: ''};
    });
  };

  const validateForm = () => {
    const nextErrors = createInitialErrors();
    let hasError = false;

    const ensureText = (
      value: string,
      field: keyof Step5FormErrors,
      message: string,
    ) => {
      if (!value.trim()) {
        nextErrors[field] = message;
        hasError = true;
      }
    };

    const ensurePositiveNumber = (
      value: string,
      field: keyof Step5FormErrors,
      emptyMessage: string,
    ) => {
      if (!value.trim()) {
        nextErrors[field] = emptyMessage;
        hasError = true;
        return;
      }

      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        nextErrors[field] = 'Enter a value greater than 0';
        hasError = true;
      }
    };

    ensureText(
      formData.productName,
      'productName',
      'Product name is required',
    );
    ensureText(formData.brandName, 'brandName', 'Brand name is required');

    if (!formData.manufacturingCountry) {
      nextErrors.manufacturingCountry = 'Select Manufacturing Country';
      hasError = true;
    }

    ensureText(formData.batchNumber, 'batchNumber', 'Batch number is required');
    ensurePositiveNumber(
      formData.frequencyUsed,
      'frequencyUsed',
      'Enter how often the product was used',
    );
    ensurePositiveNumber(
      formData.quantityUsed,
      'quantityUsed',
      'Enter the quantity used',
    );

    if (!formData.administrationMethod) {
      nextErrors.administrationMethod = 'Select how the product was administered';
      hasError = true;
    }

    ensureText(
      formData.reasonToUseProduct,
      'reasonToUseProduct',
      'Tell us why the product was used',
    );
    ensureText(
      formData.petConditionBefore,
      'petConditionBefore',
      'Describe the pet condition before usage',
    );
    ensureText(
      formData.petConditionAfter,
      'petConditionAfter',
      'Describe the pet condition after usage',
    );

    if (formData.files.length === 0) {
      nextErrors.files = 'Upload at least one product image';
      hasError = true;
    }

    setFormErrors(nextErrors);
    return !hasError;
  };

  const {
    fileToDelete,
    handleTakePhoto,
    handleChooseFromGallery,
    handleUploadFromDrive,
    handleRemoveFile,
    confirmDeleteFile,
  } = useFileOperations<DocumentFile>({
    files: formData.files,
    setFiles: files => {
      setFormData(prev => ({...prev, files}));
      clearFieldError('files');
    },
    clearError: () => clearFieldError('files'),
    openSheet,
    closeSheet,
    deleteSheetRef,
  });

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }
    navigation.navigate('ThankYou');
  };

  return (
    <>
    <AERLayout
      stepLabel="Step 5 of 5"
      onBack={() => navigation.goBack()}
      bottomButton={{ title: 'Next', onPress: handleSubmit }}
    >
      <Text style={styles.sectionTitle}>Product Information</Text>

        <Input
          label="Product name"
          value={formData.productName}
          onChangeText={text => {
            setFormData(prev => ({...prev, productName: text}));
            clearFieldError('productName');
          }}
          containerStyle={styles.input}
          error={formErrors.productName}
        />

        <Input
          label="Brand name"
          value={formData.brandName}
          onChangeText={text => {
            setFormData(prev => ({...prev, brandName: text}));
            clearFieldError('brandName');
          }}
          containerStyle={styles.input}
          error={formErrors.brandName}
        />

        <TouchableInput
          label="Manufacturing country"
          value={formData.manufacturingCountry?.name ?? ''}
          placeholder="Select country"
          onPress={() => {
            openSheet('country');
            countrySheetRef.current?.open();
          }}
          rightComponent={<Image source={Images.dropdownIcon} style={common.dropdownIcon} />}
          containerStyle={styles.input}
          error={formErrors.manufacturingCountry}
        />

        <Input
          label="Batch number"
          value={formData.batchNumber}
          onChangeText={text => {
            setFormData(prev => ({...prev, batchNumber: text}));
            clearFieldError('batchNumber');
          }}
          containerStyle={styles.input}
          error={formErrors.batchNumber}
        />

        <Input
          label="Number of times product used"
          value={formData.frequencyUsed}
          onChangeText={text => {
            setFormData(prev => ({...prev, frequencyUsed: text}));
            clearFieldError('frequencyUsed');
          }}
          keyboardType="numeric"
          containerStyle={styles.input}
          error={formErrors.frequencyUsed}
        />

        <Input
          label="Quantity used"
          value={formData.quantityUsed}
          onChangeText={text => {
            setFormData(prev => ({...prev, quantityUsed: text}));
            clearFieldError('quantityUsed');
          }}
          containerStyle={styles.input}
          error={formErrors.quantityUsed}
        />

        <View style={styles.checkboxRow}>
          <Checkbox
            value={formData.quantityUnit === 'tablet'}
            onValueChange={val =>
              val && setFormData(prev => ({...prev, quantityUnit: 'tablet'}))
            }
            label="Tablet - Piece"
            labelStyle={styles.checkboxLabelInline}
          />
          <View style={{width: theme.spacing[4]}} />
          <Checkbox
            value={formData.quantityUnit === 'liquid'}
            onValueChange={val =>
              val && setFormData(prev => ({...prev, quantityUnit: 'liquid'}))
            }
            label="Liquid - ML"
            labelStyle={styles.checkboxLabelInline}
          />
        </View>

        <TouchableInput
          label="How was the product administered?"
          value={formData.administrationMethod ?? ''}
          placeholder="How was the product administered?"
          onPress={() => {
            openSheet('admin');
            adminSheetRef.current?.open();
          }}
          rightComponent={<Image source={Images.dropdownIcon} style={common.dropdownIcon} />}
          containerStyle={styles.input}
          error={formErrors.administrationMethod}
        />

        <Input
          label="Reason to use the product."
          value={formData.reasonToUseProduct}
          onChangeText={text => {
            setFormData(prev => ({...prev, reasonToUseProduct: text}));
            clearFieldError('reasonToUseProduct');
          }}
          multiline
          containerStyle={styles.input}
          error={formErrors.reasonToUseProduct}
        />

        <Input
          label="Pet condition before drug"
          value={formData.petConditionBefore}
          onChangeText={text => {
            setFormData(prev => ({...prev, petConditionBefore: text}));
            clearFieldError('petConditionBefore');
          }}
          multiline
          containerStyle={styles.input}
          error={formErrors.petConditionBefore}
        />

        <Input
          label="Pet condition after drug"
          value={formData.petConditionAfter}
          onChangeText={text => {
            setFormData(prev => ({...prev, petConditionAfter: text}));
            clearFieldError('petConditionAfter');
          }}
          multiline
          containerStyle={styles.input}
          error={formErrors.petConditionAfter}
        />

        <View style={styles.uploadSection}>
          <Text style={styles.uploadLabel}>
            Please add image of the product used.
          </Text>
          <DocumentAttachmentsSection
            files={formData.files}
            onAddPress={() => {
              clearFieldError('files');
              openSheet('upload');
              uploadSheetRef.current?.open();
            }}
            onRequestRemove={file => handleRemoveFile(file.id)}
            emptyTitle="Upload image"
            emptySubtitle={'Only PNG, JPEG, PDF\nmax size 5 MB'}
            error={formErrors.files}
          />
        </View>

        <TouchableInput
          label="Event date"
          value={formatDateForDisplay(formData.eventDate)}
          onPress={() => setShowDatePicker(true)}
          rightComponent={<Image source={Images.calendarIcon} style={common.calendarIcon} />}
          containerStyle={styles.input}
        />

    </AERLayout>

      <SimpleDatePicker
        value={formData.eventDate}
        onDateChange={date => {
          setFormData(prev => ({...prev, eventDate: date}));
          setShowDatePicker(false);
        }}
        show={showDatePicker}
        onDismiss={() => setShowDatePicker(false)}
        maximumDate={new Date()}
        mode="date"
      />

      <CountryBottomSheet
        ref={countrySheetRef}
        countries={COUNTRIES as any}
        selectedCountry={formData.manufacturingCountry as any}
        onSave={country => {
          setFormData(prev => ({...prev, manufacturingCountry: country}));
          clearFieldError('manufacturingCountry');
          closeSheet();
        }}
      />

      <AdministrationMethodBottomSheet
        ref={adminSheetRef}
        selectedMethod={formData.administrationMethod}
        onSave={method => {
          setFormData(prev => ({...prev, administrationMethod: method}));
          clearFieldError('administrationMethod');
          closeSheet();
        }}
      />

      <UploadDeleteSheets
        uploadSheetRef={uploadSheetRef}
        deleteSheetRef={deleteSheetRef}
        files={formData.files}
        fileToDelete={fileToDelete as any}
        onTakePhoto={handleTakePhoto}
        onChooseGallery={handleChooseFromGallery}
        onUploadDrive={handleUploadFromDrive}
        onConfirmDelete={confirmDeleteFile}
        closeSheet={closeSheet}
      />
    </>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    sectionTitle: {
      ...theme.typography.h6Clash,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[4],
    },
    input: {
      marginBottom: theme.spacing[4],
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 10,
      marginBottom: theme.spacing[2],
      marginTop: theme.spacing[1],
    },
    checkboxLabel: {
      ...theme.typography.body,
      color: theme.colors.secondary,
    },
    checkboxLabelInline: {
      ...theme.typography.body,
      color: theme.colors.secondary,
      flex: 0,
    },
    uploadSection: {
      marginBottom: theme.spacing[6],
    },
    uploadLabel: {
      // Satoshi 14 Bold, 120% line-height
      ...theme.typography.subtitleBold14,
      color: theme.colors.secondary,
      opacity: 1,
      marginBottom: theme.spacing[3],
    },
    uploadButton: {
      borderWidth: 2,
      borderColor: theme.colors.primary,
      borderStyle: 'dashed',
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing[8],
      alignItems: 'center',
      justifyContent: 'center',
    },
    uploadIcon: {
      width: 40,
      height: 40,
      resizeMode: 'contain',
      marginBottom: theme.spacing[2],
      tintColor: theme.colors.primary,
    },
    uploadText: {
      ...theme.typography.labelMdBold,
      color: theme.colors.primary,
    },
    // icon styles moved to shared createCommonFormStyles
  });
