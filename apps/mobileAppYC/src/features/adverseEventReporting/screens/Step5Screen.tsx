import React, {useMemo, useRef, useState} from 'react';
import {View, ScrollView, StyleSheet, Text, Image} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '@/hooks';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {Input} from '@/shared/components/common';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
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
  UploadDocumentBottomSheet,
  type UploadDocumentBottomSheetRef,
} from '@/shared/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet';
import {
  DeleteDocumentBottomSheet,
  type DeleteDocumentBottomSheetRef,
} from '@/shared/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet';
import {useBottomSheetBackHandler} from '@/shared/hooks/useBottomSheetBackHandler';
import {useFileOperations} from '@/shared/hooks/useFileOperations';
import {
  CountryBottomSheet,
  type CountryBottomSheetRef,
} from '@/shared/components/common/CountryBottomSheet/CountryBottomSheet';
import COUNTRIES from '@/shared/utils/countryList.json';
import {
  AdministrationMethodBottomSheet,
  type AdministrationMethodBottomSheetRef,
} from '@/shared/components/common/AdministrationMethodBottomSheet/AdministrationMethodBottomSheet';
import type {DocumentFile} from '@/features/documents/types';

type Props = NativeStackScreenProps<AdverseEventStackParamList, 'Step5'>;

export const Step5Screen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [formData, setFormData] = useState({
    productName: '',
    brandName: '',
    manufacturingCountry: null as null | {
      name: string;
      code: string;
      flag: string;
      dial_code: string;
    },
    batchNumber: '',
    frequencyUsed: '',
    quantityUsed: '',
    quantityUnit: 'tablet' as 'tablet' | 'liquid',
    administrationMethod: null as
      | null
      | 'none'
      | 'by mouth'
      | 'on the skin'
      | 'subcutaneous injection'
      | 'intramuscular injection'
      | 'into the ear'
      | 'into the eye'
      | 'other',
    reasonToUseProduct: '',
    petConditionBefore: '',
    petConditionAfter: '',
    eventDate: new Date(),
    files: [] as DocumentFile[],
  });

  const [showDatePicker, setShowDatePicker] = useState(false);

  // Bottom sheet management (same open/close + back handling pattern)
  const {registerSheet, openSheet, closeSheet} = useBottomSheetBackHandler();
  const countrySheetRef = useRef<CountryBottomSheetRef>(null);
  const adminSheetRef = useRef<AdministrationMethodBottomSheetRef>(null);
  const uploadSheetRef = useRef<UploadDocumentBottomSheetRef>(null);
  const deleteSheetRef = useRef<DeleteDocumentBottomSheetRef>(null);

  // Register sheets
  React.useEffect(() => {
    registerSheet('country', countrySheetRef as any);
    registerSheet('admin', adminSheetRef as any);
    registerSheet('upload', uploadSheetRef as any);
    registerSheet('delete', deleteSheetRef as any);
  }, [registerSheet]);

  // File operations (reuse same handlers as Documents flow)
  const {
    fileToDelete,
    handleTakePhoto,
    handleChooseFromGallery,
    handleUploadFromDrive,
    handleRemoveFile,
    confirmDeleteFile,
  } = useFileOperations<DocumentFile>({
    files: formData.files,
    setFiles: files => setFormData(prev => ({...prev, files})),
    clearError: () => undefined,
    openSheet,
    closeSheet,
    deleteSheetRef,
  });

  const handleSubmit = () => {
    navigation.navigate('ThankYou');
  };

  return (
    <SafeArea>
      <Header
        title="Adverse event reporting"
        showBackButton
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.stepTitle}>Step 5 of 5</Text>
        <Text style={styles.sectionTitle}>Product Information</Text>

        <Input
          label="Product name"
          value={formData.productName}
          onChangeText={text => setFormData({...formData, productName: text})}
          containerStyle={styles.input}
        />

        <Input
          label="Brand name"
          value={formData.brandName}
          onChangeText={text => setFormData({...formData, brandName: text})}
          containerStyle={styles.input}
        />

        <TouchableInput
          label="Manufacturing country"
          value={formData.manufacturingCountry?.name ?? ''}
          placeholder="Select country"
          onPress={() => {
            openSheet('country');
            countrySheetRef.current?.open();
          }}
          rightComponent={
            <Image source={Images.dropdownIcon} style={styles.dropdownIcon} />
          }
          containerStyle={styles.input}
        />

        <Input
          label="Batch number"
          value={formData.batchNumber}
          onChangeText={text => setFormData({...formData, batchNumber: text})}
          containerStyle={styles.input}
        />

        <Input
          label="Number of times product used"
          value={formData.frequencyUsed}
          onChangeText={text => setFormData({...formData, frequencyUsed: text})}
          keyboardType="numeric"
          containerStyle={styles.input}
        />

        <Input
          label="Quantity used"
          value={formData.quantityUsed}
          onChangeText={text => setFormData({...formData, quantityUsed: text})}
          containerStyle={styles.input}
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
          rightComponent={
            <Image source={Images.dropdownIcon} style={styles.dropdownIcon} />
          }
          containerStyle={styles.input}
        />

        <Input
          label="Reason to use the product."
          value={formData.reasonToUseProduct}
          onChangeText={text =>
            setFormData({...formData, reasonToUseProduct: text})
          }
          multiline
          containerStyle={styles.input}
        />

        <Input
          label="Pet condition before drug"
          value={formData.petConditionBefore}
          onChangeText={text =>
            setFormData({...formData, petConditionBefore: text})
          }
          multiline
          containerStyle={styles.input}
        />

        <Input
          label="Pet condition after drug"
          value={formData.petConditionAfter}
          onChangeText={text =>
            setFormData({...formData, petConditionAfter: text})
          }
          multiline
          containerStyle={styles.input}
        />

        <View style={styles.uploadSection}>
          <Text style={styles.uploadLabel}>
            Please add image of the product used.
          </Text>
          <DocumentAttachmentsSection
            files={formData.files}
            onAddPress={() => {
              openSheet('upload');
              uploadSheetRef.current?.open();
            }}
            onRequestRemove={file => handleRemoveFile(file.id)}
            emptyTitle="Upload image"
            emptySubtitle={'Only PNG, JPEG, PDF\nmax size 5 MB'}
          />
        </View>

        <TouchableInput
          label="Event date"
          value={formatDateForDisplay(formData.eventDate)}
          onPress={() => setShowDatePicker(true)}
          rightComponent={
            <Image source={Images.calendarIcon} style={styles.calendarIcon} />
          }
          containerStyle={styles.input}
        />

        <View style={styles.buttonContainer}>
          <LiquidGlassButton
            title="Next"
            onPress={handleSubmit}
            glassEffect="clear"
            interactive
            borderRadius="lg"
            forceBorder
            borderColor={theme.colors.borderMuted}
            height={56}
            style={styles.button}
            textStyle={styles.buttonText}
            tintColor={theme.colors.secondary}
            shadowIntensity="medium"
          />
        </View>
      </ScrollView>

      <SimpleDatePicker
        value={formData.eventDate}
        onDateChange={date => {
          setFormData({...formData, eventDate: date});
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
          closeSheet();
        }}
      />

      <AdministrationMethodBottomSheet
        ref={adminSheetRef}
        selectedMethod={formData.administrationMethod}
        onSave={method => {
          setFormData(prev => ({...prev, administrationMethod: method}));
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
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    scrollContent: {
      paddingHorizontal: theme.spacing[4],
      paddingTop: theme.spacing[4],
      paddingBottom: theme.spacing[24],
    },
    stepTitle: {
      // Satoshi 12 Bold, 100% line-height, centered, Jet-400
      ...theme.typography.subtitleBold12,
      lineHeight: 12,
      color: theme.colors.placeholder,
      marginBottom: theme.spacing[4],
      textAlign: 'center',
    },
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
    dropdownIcon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
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
    calendarIcon: {
      width: theme.spacing[5],
      height: theme.spacing[5],
      tintColor: theme.colors.textSecondary,
    },
    buttonContainer: {
      marginTop: theme.spacing[4],
    },
    button: {
      width: '100%',
      backgroundColor: theme.colors.secondary,
      borderRadius: theme.borderRadius.lg,
    },
    buttonText: {
      ...theme.typography.cta,
      color: theme.colors.background,
      textAlign: 'center',
    },
  });
