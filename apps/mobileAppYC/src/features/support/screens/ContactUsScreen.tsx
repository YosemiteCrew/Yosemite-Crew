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
  CONFIRMATION_CHECKBOXES.reduce<ConfirmationState>((acc, option) => {
    acc[option.id] = false;
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

// Small presentational helpers lifted to module scope to avoid deep nesting
type Option = {id: string; label: string};

type SimpleFormErrors = Record<
  'general' | 'feature',
  Partial<Record<'subject' | 'message', string>>
>;

type DsarFormErrors = Partial<
  Record<
    | 'submitterId'
    | 'lawId'
    | 'otherLawNotes'
    | 'requestId'
    | 'otherRequestNotes'
    | 'message'
    | 'confirmations',
    string
  >
>;

type ComplaintFormErrors = Partial<
  Record<'submitterId' | 'description' | 'referenceLink' | 'confirmations', string>
>;

const isValidUrl = (value: string): boolean => {
  if (!value) {
    return false;
  }
  const urlConstructor = URL as unknown as {
    canParse?: (input: string, base?: string) => boolean;
  };
  if (typeof urlConstructor.canParse === 'function') {
    return urlConstructor.canParse(value);
  }
  try {
    const parsedUrl = new URL(value);
    return Boolean(parsedUrl);
  } catch {
    return false;
  }
};

const SelectionList: React.FC<{
  options: Option[];
  selectedId: string | null | undefined;
  onSelect: (id: string) => void;
  styles: ReturnType<typeof createStyles>;
  error?: string;
}> = ({options, selectedId, onSelect, styles, error}) => (
  <View>
    <View style={styles.optionsBox}>
      {options.map(option => {
        const isSelected = selectedId === option.id;
        return (
          <TouchableOpacity
            key={option.id}
            style={styles.optionRow}
            onPress={() => onSelect(option.id)}
            activeOpacity={0.8}>
            <Text
              style={isSelected ? styles.optionTextSelected : styles.optionText}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
  </View>
);

const ConfirmationList: React.FC<{
  values: ConfirmationState;
  onToggle: (checkboxId: string) => void;
  styles: ReturnType<typeof createStyles>;
  error?: string;
}> = ({values, onToggle, styles, error}) => (
  <View style={styles.checkboxGroup}>
    {CONFIRMATION_CHECKBOXES.map(option => {
      const isChecked = values[option.id];
      return (
        <Checkbox
          key={option.id}
          value={isChecked}
          onValueChange={() => onToggle(option.id)}
          label={option.label}
          labelStyle={
            isChecked ? styles.checkboxLabelChecked : styles.checkboxLabel
          }
        />
      );
    })}
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
  </View>
);

export const ContactUsScreen: React.FC<ContactUsScreenProps> = ({
  navigation,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [activeTab, setActiveTab] = React.useState<ContactTabId>('general');

  const {forms: simpleForms, updateForm: updateSimpleForm} =
    useSimpleFormState();

  const [simpleErrors, setSimpleErrors] = React.useState<SimpleFormErrors>({
    general: {},
    feature: {},
  });
  const [dsarErrors, setDsarErrors] = React.useState<DsarFormErrors>({});
  const [complaintErrors, setComplaintErrors] =
    React.useState<ComplaintFormErrors>({});

  const [dsarForm, setDsarForm] = React.useState({
    submitterId: null as string | null,
    lawId: null as string | null,
    otherLawNotes: '',
    requestId: null as string | null,
    otherRequestNotes: '',
    message: '',
    confirmations: buildInitialConfirmationState(),
  });

  const [complaintForm, setComplaintForm] = React.useState({
    submitterId: null as string | null,
    description: '',
    referenceLink: '',
    confirmations: buildInitialConfirmationState(),
  });

  const validateSimpleForm = React.useCallback(
    (tabId: 'general' | 'feature') => {
      const form = simpleForms[tabId];
      const errors: Partial<Record<'subject' | 'message', string>> = {};

      if (!form.subject.trim()) {
        errors.subject = 'Subject is required';
      }

      if (!form.message.trim()) {
        errors.message = 'Message is required';
      }

      setSimpleErrors(prev => ({
        ...prev,
        [tabId]: errors,
      }));

      return Object.keys(errors).length === 0;
    },
    [simpleForms],
  );

  const handleSimpleFormSubmit = React.useCallback(
    (tabId: 'general' | 'feature') => {
      const isValid = validateSimpleForm(tabId);
      if (isValid) {
        // Submission handling to be integrated here.
      }
      return isValid;
    },
    [validateSimpleForm],
  );

  const validateDsarForm = React.useCallback(() => {
    const errors: DsarFormErrors = {};

    if (!dsarForm.submitterId) {
      errors.submitterId = 'Please select who is submitting this request.';
    }

    if (!dsarForm.lawId) {
      errors.lawId = 'Regulation is required.';
    }

    if (dsarForm.lawId === 'other' && !dsarForm.otherLawNotes.trim()) {
      errors.otherLawNotes = 'Please specify the regulation.';
    }

    if (!dsarForm.requestId) {
      errors.requestId = 'Please select the request type.';
    }

    if (
      dsarForm.requestId === 'other-request' &&
      !dsarForm.otherRequestNotes.trim()
    ) {
      errors.otherRequestNotes = 'Please add additional details.';
    }

    if (!dsarForm.message.trim()) {
      errors.message = 'Message is required.';
    }

    if (!Object.values(dsarForm.confirmations).every(Boolean)) {
      errors.confirmations = 'Please confirm all statements.';
    }

    setDsarErrors(errors);
    return Object.keys(errors).length === 0;
  }, [dsarForm]);

  const handleDsarSubmit = React.useCallback(() => {
    const isValid = validateDsarForm();
    if (isValid) {
      // Submission handling to be integrated here.
    }
    return isValid;
  }, [validateDsarForm]);

  const validateComplaintForm = React.useCallback(() => {
    const errors: ComplaintFormErrors = {};

    if (!complaintForm.submitterId) {
      errors.submitterId = 'Please select who is submitting this complaint.';
    }

    if (!complaintForm.description.trim()) {
      errors.description = 'Complaint details are required.';
    }

    const trimmedLink = complaintForm.referenceLink.trim();
    if (trimmedLink && !isValidUrl(trimmedLink)) {
      errors.referenceLink = 'Please enter a valid link.';
    }

    if (!Object.values(complaintForm.confirmations).every(Boolean)) {
      errors.confirmations = 'Please confirm all statements.';
    }

    setComplaintErrors(errors);
    return Object.keys(errors).length === 0;
  }, [complaintForm]);

  const handleComplaintSubmit = React.useCallback(() => {
    const isValid = validateComplaintForm();
    if (isValid) {
      // Submission handling to be integrated here.
    }
    return isValid;
  }, [validateComplaintForm]);

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
        setDsarForm(prev => {
          const updatedConfirmations = {
            ...prev.confirmations,
            [checkboxId]: !prev.confirmations[checkboxId],
          };
          const allChecked = Object.values(updatedConfirmations).every(Boolean);
          setDsarErrors(prevErrors => {
            if (allChecked && prevErrors.confirmations) {
              const nextErrors = {...prevErrors};
              delete nextErrors.confirmations;
              return nextErrors;
            }
            return prevErrors;
          });
          return {
            ...prev,
            confirmations: updatedConfirmations,
          };
        });
      } else {
        setComplaintForm(prev => {
          const updatedConfirmations = {
            ...prev.confirmations,
            [checkboxId]: !prev.confirmations[checkboxId],
          };
          const allChecked = Object.values(updatedConfirmations).every(Boolean);
          setComplaintErrors(prevErrors => {
            if (allChecked && prevErrors.confirmations) {
              const nextErrors = {...prevErrors};
              delete nextErrors.confirmations;
              return nextErrors;
            }
            return prevErrors;
          });
          return {
            ...prev,
            confirmations: updatedConfirmations,
          };
        });
      }
    },
    [setComplaintErrors, setDsarErrors],
  );

  const handleRequestSelect = React.useCallback(
    (requestId: string) => {
      setDsarForm(prev => ({
        ...prev,
        requestId,
        otherRequestNotes:
          requestId === 'other-request' ? prev.otherRequestNotes : '',
      }));
      setDsarErrors(prev => {
        const next = {...prev};
        if (next.requestId) {
          delete next.requestId;
        }
        if (requestId !== 'other-request' && next.otherRequestNotes) {
          delete next.otherRequestNotes;
        }
        return next;
      });
    },
    [setDsarErrors],
  );

  // use helpers for confirmation lists and option lists

  const renderSimpleForm = (tabId: 'general' | 'feature') => {
    const form = simpleForms[tabId];
    const errors = simpleErrors[tabId];

    return (
      <View style={styles.surfaceCard}>
        <View style={styles.formFields}>
          <Input
            label="Subject"
            value={form.subject}
            onChangeText={value => {
              updateSimpleForm(tabId, 'subject', value);
              setSimpleErrors(prev => {
                const next = {...prev[tabId]};
                if (next.subject && value.trim()) {
                  delete next.subject;
                  return {...prev, [tabId]: next};
                }
                return prev;
              });
            }}
            error={errors.subject}
          />
          <Input
            label="Your message"
            value={form.message}
            multiline
            numberOfLines={4}
            onChangeText={value => {
              updateSimpleForm(tabId, 'message', value);
              setSimpleErrors(prev => {
                const next = {...prev[tabId]};
                if (next.message && value.trim()) {
                  delete next.message;
                  return {...prev, [tabId]: next};
                }
                return prev;
              });
            }}
            textAlignVertical="top"
            inputStyle={styles.textArea}
            error={errors.message}
          />
        </View>
        <LiquidGlassButton
          title={tabId === 'feature' ? 'Send' : 'Submit'}
          onPress={() => handleSimpleFormSubmit(tabId)}
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
  };

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
        <SelectionList
          options={DSAR_SUBMITTER_OPTIONS}
          selectedId={dsarForm.submitterId}
          onSelect={id => {
            setDsarForm(prev => ({...prev, submitterId: id}));
            setDsarErrors(prev => {
              if (!prev.submitterId) {
                return prev;
              }
              const next = {...prev};
              delete next.submitterId;
              return next;
            });
          }}
          styles={styles}
          error={dsarErrors.submitterId}
        />
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
          error={dsarErrors.lawId}
          rightComponent={
            <Image source={Images.dropdownIcon} style={styles.dropdownIcon} />
          }
        />
        {dsarForm.lawId === 'other' && (
          <Input
            label="Please specify"
            value={dsarForm.otherLawNotes}
            onChangeText={value => {
              setDsarForm(prev => ({...prev, otherLawNotes: value}));
              setDsarErrors(prev => {
                if (prev.otherLawNotes && value.trim()) {
                  const next = {...prev};
                  delete next.otherLawNotes;
                  return next;
                }
                return prev;
              });
            }}
            error={dsarErrors.otherLawNotes}
          />
        )}
      </View>

      <View style={styles.surfaceCard}>
        <Text style={styles.sectionLabel}>
          You are submitting this request to
        </Text>
        <SelectionList
          options={DSAR_REQUEST_TYPES}
          selectedId={dsarForm.requestId}
          onSelect={handleRequestSelect}
          styles={styles}
          error={dsarErrors.requestId}
        />
        {dsarForm.requestId === 'other-request' && (
          <Input
            label="Additional details"
            value={dsarForm.otherRequestNotes}
            onChangeText={value => {
              setDsarForm(prev => ({...prev, otherRequestNotes: value}));
              setDsarErrors(prev => {
                if (prev.otherRequestNotes && value.trim()) {
                  const next = {...prev};
                  delete next.otherRequestNotes;
                  return next;
                }
                return prev;
              });
            }}
            error={dsarErrors.otherRequestNotes}
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
          onChangeText={value => {
            setDsarForm(prev => ({...prev, message: value}));
            setDsarErrors(prev => {
              if (prev.message && value.trim()) {
                const next = {...prev};
                delete next.message;
                return next;
              }
              return prev;
            });
          }}
          inputStyle={styles.textArea}
          error={dsarErrors.message}
        />
      </View>

      <View style={styles.surfaceCard}>
        <Text style={styles.sectionLabel}>I Confirm that</Text>
        <ConfirmationList
          values={dsarForm.confirmations}
          styles={styles}
          error={dsarErrors.confirmations}
          onToggle={checkboxId => handleToggleConfirmation('dsar', checkboxId)}
        />
        <LiquidGlassButton
          title="Submit"
          onPress={handleDsarSubmit}
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
        <SelectionList
          options={DSAR_SUBMITTER_OPTIONS}
          selectedId={complaintForm.submitterId}
          onSelect={id => {
            setComplaintForm(prev => ({...prev, submitterId: id}));
            setComplaintErrors(prev => {
              if (!prev.submitterId) {
                return prev;
              }
              const next = {...prev};
              delete next.submitterId;
              return next;
            });
          }}
          styles={styles}
          error={complaintErrors.submitterId}
        />
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
          onChangeText={value => {
            setComplaintForm(prev => ({...prev, description: value}));
            setComplaintErrors(prev => {
              if (prev.description && value.trim()) {
                const next = {...prev};
                delete next.description;
                return next;
              }
              return prev;
            });
          }}
          inputStyle={styles.textArea}
          error={complaintErrors.description}
        />
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionLabel}>
          Please add link regarding your complaint (optional)
        </Text>
        <Input
          label="Reference link"
          value={complaintForm.referenceLink}
          onChangeText={value => {
            setComplaintForm(prev => ({...prev, referenceLink: value}));
            setComplaintErrors(prev => {
              if (!prev.referenceLink) {
                return prev;
              }
              const trimmed = value.trim();
              if (!trimmed || isValidUrl(trimmed)) {
                const next = {...prev};
                delete next.referenceLink;
                return next;
              }
              return prev;
            });
          }}
          error={complaintErrors.referenceLink}
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
        <ConfirmationList
          values={complaintForm.confirmations}
          styles={styles}
          error={complaintErrors.confirmations}
          onToggle={checkboxId => handleToggleConfirmation('complaint', checkboxId)}
        />
        <LiquidGlassButton
          title="Submit"
          onPress={handleComplaintSubmit}
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
        onSelect={item => {
          const nextLawId = item?.id ?? null;
          setDsarForm(prev => ({
            ...prev,
            lawId: nextLawId,
            otherLawNotes: nextLawId === 'other' ? prev.otherLawNotes : '',
          }));
          setDsarErrors(prev => {
            const next = {...prev};
            if (next.lawId) {
              delete next.lawId;
            }
            if (nextLawId !== 'other' && next.otherLawNotes) {
              delete next.otherLawNotes;
            }
            return next;
          });
        }}
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
    errorText: {
      ...theme.typography.labelXsBold,
      color: theme.colors.error,
      marginTop: 3,
      marginBottom: theme.spacing['3'],
      marginLeft: theme.spacing['1'],
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
