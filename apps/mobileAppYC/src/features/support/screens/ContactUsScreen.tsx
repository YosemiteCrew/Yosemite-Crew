import React from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Header, Input, TouchableInput} from '@/shared/components/common';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {Checkbox} from '@/shared/components/common/Checkbox/Checkbox';
import {PillSelector} from '@/shared/components/common/PillSelector/PillSelector';
import {DocumentAttachmentsSection} from '@/features/documents/components/DocumentAttachmentsSection';
import {
  UploadDocumentBottomSheet,
  type UploadDocumentBottomSheetRef,
} from '@/shared/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet';
import {
  DeleteDocumentBottomSheet,
  type DeleteDocumentBottomSheetRef,
} from '@/shared/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet';
import {useTheme, useFileOperations} from '@/hooks';
import {Images} from '@/assets/images';
import type {HomeStackParamList} from '@/navigation/types';
import {
  CONTACT_TABS,
  type ContactTabId,
  DSAR_SUBMITTER_OPTIONS,
  DSAR_REQUEST_TYPES,
  CONFIRMATION_CHECKBOXES,
  DSAR_LAW_OPTIONS,
} from '../data/contactData';
import DataSubjectLawBottomSheet, {
  type DataSubjectLawBottomSheetRef,
} from '../components/DataSubjectLawBottomSheet';
import type {DocumentFile} from '@/features/documents/types';

type ContactUsScreenProps = NativeStackScreenProps<
  HomeStackParamList,
  'ContactUs'
>;

type ConfirmationState = Record<string, boolean>;

const buildInitialConfirmationState = (): ConfirmationState =>
  CONFIRMATION_CHECKBOXES.reduce<ConfirmationState>((acc, option, index) => {
    acc[option.id] = index === 0; // First option selected by default
    return acc;
  }, {});

const useSimpleFormState = () => {
  const [forms, setForms] = React.useState<
    Record<'general' | 'feature', {subject: string; message: string}>
  >({
    general: {subject: '', message: ''},
    feature: {subject: '', message: ''},
  });

  const updateForm = React.useCallback(
    (
      tabId: 'general' | 'feature',
      field: 'subject' | 'message',
      value: string,
    ) => {
      setForms(prev => ({
        ...prev,
        [tabId]: {...prev[tabId], [field]: value},
      }));
    },
    [],
  );

  return {forms, updateForm};
};

export const ContactUsScreen: React.FC<ContactUsScreenProps> = ({
  navigation,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [activeTab, setActiveTab] = React.useState<ContactTabId>('general');

  const {forms: simpleForms, updateForm: updateSimpleForm} =
    useSimpleFormState();

  const [dsarForm, setDsarForm] = React.useState({
    submitterId: DSAR_SUBMITTER_OPTIONS[0].id,
    lawId: null as string | null,
    otherLawNotes: '',
    requestId: null as string | null,
    otherRequestNotes: '',
    message: '',
    confirmations: buildInitialConfirmationState(),
  });

  const [complaintForm, setComplaintForm] = React.useState({
    submitterId: DSAR_SUBMITTER_OPTIONS[0].id,
    description: '',
    referenceLink: '',
    confirmations: buildInitialConfirmationState(),
  });

  const lawSheetRef = React.useRef<DataSubjectLawBottomSheetRef>(null);
  const uploadSheetRef = React.useRef<UploadDocumentBottomSheetRef>(null);
  const deleteSheetRef = React.useRef<DeleteDocumentBottomSheetRef>(null);
  const activeSheetRef = React.useRef<'upload' | 'delete' | null>(null);
  const [complaintAttachments, setComplaintAttachments] = React.useState<
    DocumentFile[]
  >([]);
  const [attachmentError, setAttachmentError] = React.useState<
    string | undefined
  >(undefined);

  const openSheet = React.useCallback((sheet: string) => {
    if (sheet === 'upload') {
      activeSheetRef.current = 'upload';
      uploadSheetRef.current?.open();
    } else if (sheet === 'delete') {
      activeSheetRef.current = 'delete';
      deleteSheetRef.current?.open();
    }
  }, []);

  const closeSheet = React.useCallback(() => {
    if (activeSheetRef.current === 'upload') {
      uploadSheetRef.current?.close();
    } else if (activeSheetRef.current === 'delete') {
      deleteSheetRef.current?.close();
    }
    activeSheetRef.current = null;
  }, []);

  const {
    fileToDelete,
    handleTakePhoto,
    handleChooseFromGallery,
    handleUploadFromDrive,
    handleRemoveFile,
    confirmDeleteFile,
  } = useFileOperations<DocumentFile>({
    files: complaintAttachments,
    setFiles: files => {
      setComplaintAttachments(files);
      setAttachmentError(undefined);
    },
    clearError: () => setAttachmentError(undefined),
    openSheet,
    closeSheet,
    deleteSheetRef,
  });

  // Ensure upload sheet is available and wired to handlers like DocumentForm

  const handleToggleConfirmation = React.useCallback(
    (form: 'dsar' | 'complaint', checkboxId: string) => {
      if (form === 'dsar') {
        setDsarForm(prev => ({
          ...prev,
          confirmations: {
            ...prev.confirmations,
            [checkboxId]: !prev.confirmations[checkboxId],
          },
        }));
      } else {
        setComplaintForm(prev => ({
          ...prev,
          confirmations: {
            ...prev.confirmations,
            [checkboxId]: !prev.confirmations[checkboxId],
          },
        }));
      }
    },
    [],
  );

  const handleRequestSelect = React.useCallback((requestId: string) => {
    setDsarForm(prev => ({
      ...prev,
      requestId,
      otherRequestNotes:
        requestId === 'other-request' ? prev.otherRequestNotes : '',
    }));
  }, []);

  const renderConfirmationList = React.useCallback(
    (form: 'dsar' | 'complaint', values: ConfirmationState) => (
      <View style={styles.checkboxGroup}>
        {CONFIRMATION_CHECKBOXES.map(option => {
          const isChecked = values[option.id];
          return (
            <Checkbox
              key={option.id}
              value={isChecked}
              onValueChange={() => handleToggleConfirmation(form, option.id)}
              label={option.label}
              labelStyle={
                isChecked ? styles.checkboxLabelChecked : styles.checkboxLabel
              }
            />
          );
        })}
      </View>
    ),
    [
      handleToggleConfirmation,
      styles.checkboxGroup,
      styles.checkboxLabel,
      styles.checkboxLabelChecked,
    ],
  );

  const renderSimpleForm = React.useCallback(
    (tabId: 'general' | 'feature') => {
      const form = simpleForms[tabId];

      return (
        <View style={styles.surfaceCard}>
          <View style={styles.formFields}>
            <Input
              label="Subject"
              value={form.subject}
              onChangeText={value => updateSimpleForm(tabId, 'subject', value)}
            />
            <Input
              label="Your message"
              value={form.message}
              multiline
              numberOfLines={4}
              onChangeText={value => updateSimpleForm(tabId, 'message', value)}
              textAlignVertical="top"
              inputStyle={styles.textArea}
            />
          </View>
          <LiquidGlassButton
            title={tabId === 'feature' ? 'Send' : 'Submit'}
            onPress={() => {}}
            glassEffect="regular"
            interactive
            tintColor={theme.colors.secondary}
            borderColor={theme.colors.borderMuted}
            style={styles.button}
            textStyle={styles.buttonText}
            height={56}
            borderRadius={16}
          />
        </View>
      );
    },
    [
      simpleForms,
      styles.surfaceCard,
      styles.formFields,
      styles.textArea,
      styles.button,
      styles.buttonText,
      theme.colors.secondary,
      theme.colors.borderMuted,
      updateSimpleForm,
    ],
  );

  const lawSummary = React.useMemo(() => {
    if (!dsarForm.lawId) {
      return 'Select one';
    }
    const selected = DSAR_LAW_OPTIONS.find(
      option => option.id === dsarForm.lawId,
    );
    return selected?.label ?? 'Select one';
  }, [dsarForm.lawId]);

  const renderDsarForm = () => (
    <View style={styles.dsarContainer}>
      <View style={styles.surfaceCard}>
        <Text style={styles.sectionLabel}>
          You are submitting this request as
        </Text>
        <View style={styles.optionsBox}>
          {DSAR_SUBMITTER_OPTIONS.map(option => {
            const isSelected = dsarForm.submitterId === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={styles.optionRow}
                onPress={() =>
                  setDsarForm(prev => ({...prev, submitterId: option.id}))
                }
                activeOpacity={0.8}>
                <Text
                  style={
                    isSelected ? styles.optionTextSelected : styles.optionText
                  }>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.surfaceCard}>
        <Text style={styles.sectionLabel}>
          Under the rights of which law are you making this request?
        </Text>
        <TouchableInput
          label="Regulation"
          placeholder="Select one"
          value={dsarForm.lawId ? lawSummary : ''}
          onPress={() => {
            openSheet('law');
            lawSheetRef.current?.open();
          }}
          rightComponent={
            <Image source={Images.dropdownIcon} style={styles.dropdownIcon} />
          }
        />
        {dsarForm.lawId === 'other' && (
          <Input
            label="Please specify"
            value={dsarForm.otherLawNotes}
            onChangeText={value =>
              setDsarForm(prev => ({...prev, otherLawNotes: value}))
            }
          />
        )}
      </View>

      <View style={styles.surfaceCard}>
        <Text style={styles.sectionLabel}>
          You are submitting this request to
        </Text>
        <View style={styles.optionsBox}>
          {DSAR_REQUEST_TYPES.map(option => {
            const isSelected = dsarForm.requestId === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={styles.optionRow}
                onPress={() => handleRequestSelect(option.id)}
                activeOpacity={0.8}>
                <Text
                  style={
                    isSelected ? styles.optionTextSelected : styles.optionText
                  }>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {dsarForm.requestId === 'other-request' && (
          <Input
            label="Additional details"
            value={dsarForm.otherRequestNotes}
            onChangeText={value =>
              setDsarForm(prev => ({...prev, otherRequestNotes: value}))
            }
          />
        )}
      </View>

      <View style={styles.surfaceCard}>
        <Text style={styles.sectionLabel}>
          Please leave details regarding your action request or question
        </Text>
        <Input
          label="Your message"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          value={dsarForm.message}
          onChangeText={value =>
            setDsarForm(prev => ({...prev, message: value}))
          }
          inputStyle={styles.textArea}
        />
      </View>

      <View style={styles.surfaceCard}>
        <Text style={styles.sectionLabel}>I Confirm that</Text>
        {renderConfirmationList('dsar', dsarForm.confirmations)}
        <LiquidGlassButton
          title="Submit"
          onPress={() => {}}
          glassEffect="regular"
          interactive
          tintColor={theme.colors.secondary}
          borderColor={theme.colors.borderMuted}
          style={styles.button}
          textStyle={styles.buttonText}
          height={56}
          borderRadius={16}
        />
      </View>
    </View>
  );

  const renderComplaintForm = () => (
    <View style={styles.dsarContainer}>
      <View style={styles.formCard}>
        <Text style={styles.sectionLabel}>
          You are submitting this complaint as
        </Text>
        <View style={styles.optionsBox}>
          {DSAR_SUBMITTER_OPTIONS.map(option => {
            const isSelected = complaintForm.submitterId === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={styles.optionRow}
                onPress={() =>
                  setComplaintForm(prev => ({...prev, submitterId: option.id}))
                }
                activeOpacity={0.8}>
                <Text
                  style={
                    isSelected ? styles.optionTextSelected : styles.optionText
                  }>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionLabel}>
          Please leave details regarding your complaint
        </Text>
        <Input
          label="Your message"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          value={complaintForm.description}
          onChangeText={value =>
            setComplaintForm(prev => ({...prev, description: value}))
          }
          inputStyle={styles.textArea}
        />
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionLabel}>
          Please add link regarding your complaint (optional)
        </Text>
        <Input
          label="Reference link"
          value={complaintForm.referenceLink}
          onChangeText={value =>
            setComplaintForm(prev => ({...prev, referenceLink: value}))
          }
        />
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionLabel}>
          Please add image regarding your complaint (optional)
        </Text>
        <DocumentAttachmentsSection
          files={complaintAttachments}
          onAddPress={() => openSheet('upload')}
          onRequestRemove={file => handleRemoveFile(file.id)}
          error={attachmentError}
          emptyTitle="Upload Image"
          emptySubtitle="PNG, JPEG up to 5 MB"
        />
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionLabel}>I Confirm that</Text>
        {renderConfirmationList('complaint', complaintForm.confirmations)}
        <LiquidGlassButton
          title="Submit"
          onPress={() => {}}
          glassEffect="regular"
          interactive
          style={styles.button}
          textStyle={styles.buttonText}
          height={56}
          borderRadius={16}
        />
      </View>
    </View>
  );

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'general':
        return renderSimpleForm('general');
      case 'feature':
        return renderSimpleForm('feature');
      case 'data-subject':
        return renderDsarForm();
      case 'complaint':
        return renderComplaintForm();
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Contact us"
        showBackButton
        onBack={() => navigation.goBack()}
        rightIcon={Images.accountBellIcon}
        onRightPress={() => {}}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <Image source={Images.contactHero} style={styles.heroImage} />
            <View style={styles.heroTextContainerCenter}>
              <Text style={styles.heroTitle}>We’re happy to help</Text>
            </View>
          </View>

          <PillSelector
            options={CONTACT_TABS.map(tab => ({id: tab.id, label: tab.label}))}
            selectedId={activeTab}
            onSelect={id => setActiveTab(id as ContactTabId)}
            containerStyle={styles.pillContainer}
            allowScroll={false}
          />

          {renderActiveTabContent()}
        </ScrollView>
      </KeyboardAvoidingView>

      <DataSubjectLawBottomSheet
        ref={lawSheetRef}
        selectedLawId={dsarForm.lawId}
        onSelect={item =>
          setDsarForm(prev => ({
            ...prev,
            lawId: item?.id ?? null,
            otherLawNotes: item?.id === 'other' ? prev.otherLawNotes : '',
          }))
        }
      />
      <UploadDocumentBottomSheet
        ref={uploadSheetRef}
        onTakePhoto={() => {
          handleTakePhoto();
        }}
        onChooseGallery={() => {
          handleChooseFromGallery();
        }}
        onUploadDrive={() => {
          handleUploadFromDrive();
        }}
      />

      <DeleteDocumentBottomSheet
        ref={deleteSheetRef}
        documentTitle={
          fileToDelete
            ? complaintAttachments.find(f => f.id === fileToDelete)?.name
            : 'this file'
        }
        onDelete={confirmDeleteFile}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    flex: {
      flex: 1,
    },
    contentContainer: {
      marginTop: -20,
      paddingBottom: theme.spacing['10'],
      paddingHorizontal: theme.spacing['5'],
      gap: theme.spacing['4'],
    },
    heroCard: {
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing['3'],
      padding: theme.spacing['4'],
    },
    heroImage: {
      width: 320,
      height: 320,
      resizeMode: 'contain',
      alignSelf: 'center',
    },
    heroTextContainer: {
      flex: 1,
      gap: theme.spacing['2'],
    },
    heroTextContainerCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTitle: {
      ...theme.typography.h3,
      fontSize: 29,
      letterSpacing: -0.29,
      color: theme.colors.text,
      textAlign: 'center',
    },
    heroSubtitle: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    dropdownIcon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
      tintColor: theme.colors.textSecondary,
    },
    pillContainer: {
      marginBottom: theme.spacing['1'],
    },
    surfaceCard: {
      gap: theme.spacing['4'],
      backgroundColor: theme.colors.background,
      paddingVertical: theme.spacing['2'],
      paddingHorizontal: theme.spacing['0'],
    },
    formCard: {
      gap: theme.spacing['4'],
    },
    formFields: {
      gap: theme.spacing['3'],
    },
    textArea: {
      minHeight: 120,
    },
    sectionLabel: {
      fontFamily:
        theme.typography.titleSmall.fontFamily || 'ClashGrotesk-Medium',
      fontSize: 16,
      fontWeight: '500',
      lineHeight: 16 * 1.2,
      color: theme.colors.text,
    },
    selectionGroup: {
      gap: theme.spacing['2'],
    },
    optionsBox: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: theme.colors.cardBackground,
    },
    optionRow: {
      paddingVertical: theme.spacing['3'],
      paddingHorizontal: theme.spacing['4'],
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    optionText: {
      color: theme.colors.text,
      ...theme.typography.paragraph,
    },
    optionTextSelected: {
      color: theme.colors.text,
      ...theme.typography.paragraphBold,
    },
    selectionTile: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing['3'],
      backgroundColor: theme.colors.surface,
    },
    selectionTileActive: {
      // no highlight color per design; keep background transparent
      backgroundColor: 'transparent',
      borderColor: theme.colors.border,
    },
    selectionLabel: {
      ...theme.typography.titleSmall,
      color: theme.colors.text,
      fontFamily: theme.typography.titleSmall.fontFamily,
      fontWeight: theme.typography.titleSmall.fontWeight,
      fontSize: 16,
    },
    selectionLabelActive: {
      ...theme.typography.titleSmall,
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: theme.typography.titleSmall.fontWeight,
    },
    checkboxGroup: {
      gap: theme.spacing['2'],
    },
    checkboxLabel: {
      ...theme.typography.subtitleRegular14,
      fontSize: 15,
      fontWeight: '400',
      color: theme.colors.text,
      letterSpacing: -0.3,
    },
    checkboxLabelChecked: {
      ...theme.typography.subtitleBold14,
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
      letterSpacing: -0.3,
    },
    uploadArea: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing['6'],
      gap: theme.spacing['2'],
      backgroundColor: theme.colors.primarySurface,
    },
    uploadIcon: {
      width: 40,
      height: 40,
      tintColor: theme.colors.primary,
      resizeMode: 'contain',
    },
    uploadLabel: {
      ...theme.typography.labelSmall,
      color: theme.colors.primary,
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
    glassButtonDark: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing['3'],
    },
    glassButtonDarkText: {
      color: theme.colors.onPrimary,
    },
    dsarContainer: {
      gap: theme.spacing['4'],
    },
  });

export default ContactUsScreen;
