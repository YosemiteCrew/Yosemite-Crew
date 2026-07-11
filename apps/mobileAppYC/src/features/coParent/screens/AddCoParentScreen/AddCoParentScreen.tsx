import React, {useState, useCallback, useMemo} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import {useForm, Controller} from 'react-hook-form';
import type {AppDispatch} from '@/app/store';
import type {Theme} from '@/theme';
import {useTheme} from '@/hooks';
import {Header} from '@/shared/components/common/Header/Header';
import {Input} from '@/shared/components/common';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {addCoParent} from '../../thunks';
import type {CoParentStackParamList} from '@/navigation/types';
import AddCoParentBottomSheet, {
  type AddCoParentBottomSheetRef,
} from '../../components/AddCoParentBottomSheet/AddCoParentBottomSheet';
import {
  selectCompanions,
  selectSelectedCompanionId,
} from '@/features/companion';

type Props = NativeStackScreenProps<CoParentStackParamList, 'AddCoParent'>;

interface InviteFormData {
  candidateName: string;
  email: string;
  phoneNumber: string;
}

export const AddCoParentScreen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();
  const companions = useSelector(selectCompanions);
  const selectedCompanionId = useSelector(selectSelectedCompanionId);
  const selectedCompanion = useMemo(
    () =>
      companions.find(c => c.id === selectedCompanionId) ??
      companions[0] ??
      null,
    [companions, selectedCompanionId],
  );
  const addCoParentSheetRef = React.useRef<AddCoParentBottomSheetRef>(null);
  // Separate state for submitted data (for bottom sheet display)
  const [submittedData, setSubmittedData] = useState<InviteFormData>({
    candidateName: '',
    email: '',
    phoneNumber: '',
  });

  const {
    control,
    handleSubmit,
    formState: {errors, isSubmitting},
    reset,
  } = useForm<InviteFormData>({
    defaultValues: {
      candidateName: '',
      email: '',
      phoneNumber: '',
    },
    mode: 'onChange',
  });

  const handleSendInvite = useCallback(
    async (data: InviteFormData) => {
      try {
        if (!selectedCompanion?.id) {
          Alert.alert(
            'Select companion',
            'Please select a companion to invite.',
          );
          return;
        }

        await dispatch(
          addCoParent({
            inviteRequest: {
              ...data,
              companionId: selectedCompanion.id,
            },
            companionName: selectedCompanion.name,
            companionImage: selectedCompanion.profileImage ?? undefined,
          }),
        ).unwrap();

        // Store submitted data for bottom sheet display
        setSubmittedData({
          candidateName: data.candidateName,
          email: data.email,
          phoneNumber: data.phoneNumber,
        });

        // Show added co-parent bottom sheet
        addCoParentSheetRef.current?.open();

        // Reset form
        reset();
      } catch (error) {
        console.error('Failed to add co-parent:', error);
        Alert.alert('Error', 'Failed to send invite');
      }
    },
    [dispatch, reset, selectedCompanion],
  );

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handleAddCoParentClose = useCallback(() => {
    addCoParentSheetRef.current?.close();
    navigation.goBack();
  }, [navigation]);

  return (
    <LiquidGlassHeaderScreen
      header={
        <Header
          title="Add co-parent"
          showBackButton
          onBack={handleBack}
          glass={false}
        />
      }
      cardGap={theme.spacing['3']}
      contentPadding={theme.spacing['1']}>
      {contentPaddingStyle => (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, contentPaddingStyle]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {/* Invite Form - always visible */}
            <View style={styles.formContainer}>
              <View style={styles.formSection}>
                <Controller
                  control={control}
                  name="candidateName"
                  rules={{
                    required: 'Co-Parent name is required',
                    minLength: {
                      value: 2,
                      message: 'Name must be at least 2 characters',
                    },
                    pattern: {
                      value: /^[A-Za-z\s]+$/,
                      message: 'Name can only contain letters and spaces',
                    },
                  }}
                  render={({field: {onChange, value}}) => (
                    <Input
                      label="Co-Parent name"
                      value={value}
                      onChangeText={onChange}
                      error={errors.candidateName?.message}
                      maxLength={50}
                      containerStyle={styles.inputContainer}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="email"
                  rules={{
                    required: 'Email address is required',
                    pattern: {
                      value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                      message: 'Please enter a valid email address',
                    },
                  }}
                  render={({field: {onChange, value}}) => (
                    <Input
                      label="Email address"
                      value={value}
                      onChangeText={onChange}
                      keyboardType="email-address"
                      error={errors.email?.message}
                      containerStyle={styles.inputContainer}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="phoneNumber"
                  rules={{
                    pattern: {
                      value: /^\d{10}$/,
                      message: 'Please enter a valid 10-digit phone number',
                    },
                  }}
                  render={({field: {onChange, value}}) => (
                    <Input
                      label="Mobile (optional)"
                      value={value}
                      onChangeText={onChange}
                      keyboardType="phone-pad"
                      error={errors.phoneNumber?.message}
                      containerStyle={styles.inputContainer}
                    />
                  )}
                />
              </View>

              {/* Send Invite Button */}
              <View style={styles.saveButton}>
                <LiquidGlassButton
                  title={isSubmitting ? 'Sending...' : 'Send invite'}
                  onPress={handleSubmit(handleSendInvite)}
                  disabled={isSubmitting}
                  style={styles.button}
                  textStyle={styles.buttonText}
                  tintColor={theme.colors.cta}
                  shadowIntensity="medium"
                  height={56}
                  borderRadius={theme.borderRadius.button}
                  loading={isSubmitting}
                />
              </View>
            </View>
          </ScrollView>

          <AddCoParentBottomSheet
            ref={addCoParentSheetRef}
            coParentEmail={submittedData.email}
            coParentPhone={submittedData.phoneNumber}
            coParentName={submittedData.candidateName}
            onConfirm={handleAddCoParentClose}
          />
        </KeyboardAvoidingView>
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['5'],
      paddingBottom: theme.spacing['24'],
    },
    formContainer: {
      gap: theme.spacing['4'],
    },
    formSection: {
      gap: theme.spacing['4'],
    },
    inputContainer: {
      marginBottom: 0,
    },
    saveButton: {
      marginTop: theme.spacing['2'],
    },
    button: {
      width: '100%',
      backgroundColor: theme.colors.cta,
      borderRadius: theme.borderRadius.button,
      ...theme.shadows.cta,
    },
    buttonText: {
      ...theme.typography.buttonLarge,
      color: theme.colors.ctaText,
      textAlign: 'center',
    },
  });

export default AddCoParentScreen;
