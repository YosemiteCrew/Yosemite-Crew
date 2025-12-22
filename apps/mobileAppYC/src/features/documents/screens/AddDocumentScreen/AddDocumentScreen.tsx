/* istanbul ignore file -- document upload UI relies on native modules not mocked in Jest */
import React, {useState, useRef} from 'react';
import {useNavigation, CommonActions} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {DocumentForm, type DocumentFormData} from '@/features/documents/components/DocumentForm/DocumentForm';
import {DiscardChangesBottomSheet} from '@/shared/components/common/DiscardChangesBottomSheet/DiscardChangesBottomSheet';
import {useDocumentFormValidation, useTheme} from '@/hooks';
import {useSelector, useDispatch} from 'react-redux';
import type {RootState, AppDispatch} from '@/app/store';
import type {DocumentStackParamList} from '@/navigation/types';
import {
  addDocument,
  uploadDocumentFiles,
} from '@/features/documents/documentSlice';
import {setSelectedCompanion} from '@/features/companion';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {StyleSheet, View} from 'react-native';

type AddDocumentNavigationProp =
  NativeStackNavigationProp<DocumentStackParamList>;

export const AddDocumentScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<AddDocumentNavigationProp>();
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const [topGlassHeight, setTopGlassHeight] = React.useState(0);

  const companions = useSelector(
    (state: RootState) => state.companion.companions,
  );
  const loading = useSelector((state: RootState) => state.documents.loading);
  const selectedCompanionId = useSelector(
    (state: RootState) => state.companion.selectedCompanionId,
  );

  const [formData, setFormData] = useState<DocumentFormData>({
    category: null,
    subcategory: null,
    visitType: null,
    title: '',
    businessName: '',
    hasIssueDate: true,
    issueDate: new Date(),
    files: [],
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const discardSheetRef = useRef<any>(null);

  const {errors, clearError, validateForm, setFormError} =
    useDocumentFormValidation();

  const handleFormChange = (
    field: keyof DocumentFormData,
    value: any,
  ) => {
    setFormData(prev => ({...prev, [field]: value}));
    setHasUnsavedChanges(true);
  };

  const handleCompanionSelect = (id: string | null) => {
    dispatch(setSelectedCompanion(id));
  };

  React.useEffect(() => {
    if (!selectedCompanionId && companions.length > 0) {
      dispatch(setSelectedCompanion(companions[0].id));
    }
  }, [companions, dispatch, selectedCompanionId]);

  const handleBack = () => {
    if (hasUnsavedChanges) {
      discardSheetRef.current?.open();
    } else {
      navigation.goBack();
    }
  };

  const handleSave = async () => {
    const {hasError} = validateForm(formData);

    if (hasError) {
      return;
    }

    try {
      if (!selectedCompanionId) {
        throw new Error('Please select a pet profile to upload documents.');
      }

      console.log('[AddDocument] Starting document upload and save process');

      const uploadedFiles = await dispatch(
        uploadDocumentFiles({
          files: formData.files,
          companionId: selectedCompanionId,
        })
      ).unwrap();
      console.log('[AddDocument] Files uploaded successfully:', uploadedFiles.length);

      await dispatch(
        addDocument({
          companionId: selectedCompanionId,
          category: formData.category!,
          subcategory: formData.subcategory!,
          visitType: formData.visitType || '',
          title: formData.title,
          businessName: formData.businessName,
          issueDate: formData.hasIssueDate ? formData.issueDate.toISOString() : '',
          files: uploadedFiles,
          appointmentId: '',
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
      const message =
        typeof error === 'string'
          ? error
          : error?.message || 'Failed to add document. Please try again.';
      setFormError('files', message);
    }
  };

  return (
    <SafeArea>
      <View
        style={[styles.topSection, {paddingTop: insets.top}]}
        onLayout={event => {
          const height = event.nativeEvent.layout.height;
          if (height !== topGlassHeight) {
            setTopGlassHeight(height);
          }
        }}>
        <LiquidGlassCard
          glassEffect="clear"
          interactive={false}
          style={styles.topGlassCard}
          fallbackStyle={styles.topGlassFallback}>
          <Header
            title="Add document"
            showBackButton={true}
            onBack={handleBack}
            glass={false}
          />
        </LiquidGlassCard>
      </View>
      <DocumentForm
        companions={companions}
        selectedCompanionId={selectedCompanionId}
        onCompanionSelect={handleCompanionSelect}
        formData={formData}
        onFormChange={handleFormChange}
        errors={errors}
        onErrorClear={clearError}
        loading={loading}
        onSave={handleSave}
        saveButtonText="Save"
        showNote={true}
        contentContainerStyle={
          topGlassHeight
            ? {paddingTop: Math.max(0, topGlassHeight - insets.top) + theme.spacing['3']}
            : undefined
        }
      />

      <DiscardChangesBottomSheet
        ref={discardSheetRef}
        onDiscard={() => navigation.goBack()}
      />
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    topSection: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 2,
    },
    topGlassCard: {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: theme.borderRadius['2xl'],
      borderBottomRightRadius: theme.borderRadius['2xl'],
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: theme.spacing['3'],
      borderWidth: 0,
      borderColor: 'transparent',
      overflow: 'hidden',
    },
    topGlassFallback: {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: theme.borderRadius['2xl'],
      borderBottomRightRadius: theme.borderRadius['2xl'],
      borderWidth: 0,
      borderColor: 'transparent',
    },
  });
