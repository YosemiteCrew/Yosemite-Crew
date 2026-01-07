import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  Linking,
} from 'react-native';
import {useNavigation, useRoute, useIsFocused} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';
import {Header} from '@/shared/components/common/Header/Header';
import {Input} from '@/shared/components/common/Input/Input';
import {Checkbox} from '@/shared/components/common/Checkbox/Checkbox';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '@/hooks';
import type {RootState, AppDispatch} from '@/app/store';
import type {AppointmentStackParamList} from '@/navigation/types';
import {selectFormsForAppointment, selectFormsLoading, selectFormSubmitting, selectSigningStatus, submitAppointmentForm, startFormSigning, fetchAppointmentForms} from '@/features/forms';
import type {FormField} from '@yosemite-crew/types';
import {createFormStyles} from '@/shared/utils/formStyles';
import {formatDateToISODate} from '@/shared/utils/dateHelpers';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import type {Appointment} from '@/features/appointments/types';

type Route = RouteProp<AppointmentStackParamList, 'AppointmentForm'>;
type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

const getDisplayDate = (value?: Date | string | null): string => {
  if (!value) return '';
  const dateObj = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dateObj.getTime())) return '';
  try {
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return formatDateToISODate(dateObj) ?? '';
  }
};

const isTruthy = (val: any): boolean => {
  if (Array.isArray(val)) {
    return val.length > 0;
  }
  return val !== undefined && val !== null && `${val}`.trim?.() !== '';
};

const textIncludes = (haystack: string | undefined, needles: string[]) => {
  if (!haystack) {
    return false;
  }
  const lower = haystack.toLowerCase();
  return needles.some(n => lower.includes(n.toLowerCase()));
};

const cleanPlaceholder = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  return value.replace(/pet/gi, 'companion');
};

const cleanLabel = (value?: string | null): string | undefined => {
  if (!value) return value ?? undefined;
  return value.replace(/pet/gi, 'Companion');
};

export const AppointmentFormScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const dispatch = useDispatch<AppDispatch>();
  const {appointmentId, formId, mode, allowSign} = route.params;
  const isFocused = useIsFocused();
  const appointment: Appointment | undefined = useSelector((state: RootState) =>
    state.appointments.items.find(a => a.id === appointmentId),
  );
  const companion = useSelector((state: RootState) =>
    appointment?.companionId ? state.companion.companions.find(c => c.id === appointment.companionId) : null,
  );
  const user = useSelector((state: RootState) => state.auth.user);
  const forms = useSelector((state: RootState) => selectFormsForAppointment(state, appointmentId));
  const entry = forms.find(item => item.form._id === formId);
  const loading = useSelector((state: RootState) => selectFormsLoading(state, appointmentId));
  const submitting = useSelector((state: RootState) => selectFormSubmitting(state, formId));
  const submissionId = entry?.submission?._id ?? null;
  const signing = useSelector((state: RootState) =>
    submissionId ? selectSigningStatus(state, submissionId) : false,
  );
  const signedPdfUrl = entry?.submission?.signing?.pdf?.url;

  const [values, setValues] = useState<Record<string, any>>(entry?.submission?.answers ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isReadOnly = Boolean(entry?.submission && mode !== 'fill');
  const canStartSigning =
    allowSign && entry?.signingRequired && entry.submission && entry.status !== 'signed';

  useEffect(() => {
    setValues(entry?.submission?.answers ?? {});
  }, [entry?.submission]);

  useEffect(() => {
    if (!entry?.form?.schema) {
      return;
    }
    const ownerFullName =
      [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.email || '';
    const companionName = companion?.name ?? appointment?.companionName ?? '';
    const today = new Date();

    const shouldPrefillOwner = (field: FormField) =>
      textIncludes(field.id, ['owner', 'guardian', 'client', 'parent']) ||
      textIncludes(field.label, ['owner', 'guardian', 'client', 'parent']);

    const shouldPrefillCompanion = (field: FormField) =>
      textIncludes(field.id, ['companion', 'patient', 'pet', 'animal']) ||
      textIncludes(field.label, ['companion', 'patient', 'pet', 'animal']);

    setValues(prev => {
      const next = {...prev};
      let updated = false;

      const fill = (field: FormField) => {
        if (field.type === 'group') {
          if (Array.isArray((field as any).fields)) {
            (field as any).fields.forEach(fill);
          }
          return;
        }
        const isCheckboxField = field.type === 'choice' || field.type === 'checkbox';
        if (isCheckboxField) {
          return;
        }
        if (field.type === 'date' && !isTruthy(next[field.id])) {
          next[field.id] = today;
          updated = true;
          return;
        }
        if (isTruthy(next[field.id])) {
          return;
        }
        if (shouldPrefillOwner(field) && ownerFullName) {
          next[field.id] = ownerFullName;
          updated = true;
          return;
        }
    if (shouldPrefillCompanion(field) && companionName) {
      next[field.id] = companionName;
      updated = true;
      return;
    }
        if (lockNonCheckboxInputs) {
          const placeholderVal = (field as any).placeholder ?? (field as any).text ?? '';
          if (placeholderVal) {
            next[field.id] = cleanPlaceholder(placeholderVal);
            updated = true;
          }
        }
      };

      entry.form.schema.forEach(fill);
      return updated ? next : prev;
    });
  }, [
    appointment?.companionName,
    companion?.name,
    entry?.form?.schema,
    entry?.submission,
    user?.email,
    user?.firstName,
    user?.lastName,
  ]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }
    if (!entry && appointment) {
      dispatch(
        fetchAppointmentForms({
          appointmentId,
          serviceId: appointment.serviceId ?? null,
          organisationId: appointment.businessId ?? null,
          species: appointment.species ?? null,
        }),
      ).catch(() => {});
    }
  }, [appointment, appointmentId, dispatch, entry, isFocused]);

  const handleChange = (fieldId: string, value: any) => {
    setValues(prev => ({...prev, [fieldId]: value}));
    setErrors(prev => ({...prev, [fieldId]: ''}));
  };

  const validateField = (field: FormField): boolean => {
    if (field.type === 'group') {
      const groupFields = (field as any).fields;
      if (!Array.isArray(groupFields)) {
        return true;
      }
      return groupFields.every(validateField);
    }
    if (field.type === 'signature') {
      // Signature will be captured during signing
      return true;
    }
    if (lockNonCheckboxInputs && field.type !== 'choice') {
      // In signing mode, only checkboxes are interactable; skip validation for locked fields
      return true;
    }
    if (!field.required) {
      return true;
    }
    const val = values[field.id];
    const ok = isTruthy(val);
    if (!ok) {
      setErrors(prev => ({...prev, [field.id]: 'Required'}));
    }
    return ok;
  };

  const validateForm = (): boolean => {
    if (!entry?.form.schema) {
      return true;
    }
    setErrors({});
    return entry.form.schema.every(validateField);
  };

  const lockNonCheckboxInputs = Boolean(allowSign);

  const handleSubmit = async () => {
    if (!entry) {
      return;
    }
    const valid = validateForm();
    if (!valid) {
      return;
    }
    try {
      const result = await dispatch(
        submitAppointmentForm({
          appointmentId,
          form: entry.form,
          answers: values,
          formVersion: entry.formVersion,
          companionId: appointment?.companionId ?? null,
        }),
      ).unwrap();

      if (entry.signingRequired && result.submission?._id) {
        try {
          const signResult = await dispatch(
            startFormSigning({
              appointmentId,
              submissionId: result.submission._id,
            }),
          ).unwrap();

          if (signResult.signingUrl) {
            navigation.navigate('FormSigning', {
              appointmentId,
              submissionId: result.submission._id,
              signingUrl: signResult.signingUrl,
              formTitle: entry.form.name,
            });
            return;
          }
        } catch (error: any) {
          const message = typeof error === 'string' ? error : error?.message ?? 'Unable to start signing.';
          Alert.alert('Signing not started', message);
        }
      }

      navigation.goBack();
    } catch (error: any) {
      const message =
        typeof error === 'string'
          ? error
          : error?.message ?? 'Unable to submit form. Please try again.';
      Alert.alert('Submit failed', message);
    }
  };

  const handleStartSigning = async () => {
    if (!entry?.submission?._id) {
      return;
    }
    try {
      const result = await dispatch(
        startFormSigning({
          appointmentId,
          submissionId: entry.submission._id,
        }),
      ).unwrap();
      if (result.signingUrl) {
        navigation.navigate('FormSigning', {
          appointmentId,
          submissionId: entry.submission._id,
          signingUrl: result.signingUrl,
          formTitle: entry.form.name,
        });
      } else {
        Alert.alert(
          'Signing started',
          'Signing link is not available yet. Please check again shortly from the appointment.',
        );
      }
    } catch (error: any) {
      const message =
        typeof error === 'string'
          ? error
          : error?.message ?? 'Unable to start signing. Please try again.';
      Alert.alert('Signing failed', message);
    }
  };

  const handleOpenSignedPdf = React.useCallback(() => {
    if (!signedPdfUrl) {
      return;
    }
    Linking.openURL(signedPdfUrl).catch(() => {
      Alert.alert('Unable to open PDF', 'Please try again in a moment.');
    });
  }, [signedPdfUrl]);

  const renderChoiceOptions = (field: FormField & {options?: any[]}, multiple: boolean) => {
    const disableSelection = lockNonCheckboxInputs && !multiple;
    const selected = values[field.id];
    return (
      <View style={styles.optionList}>
        {(field.options ?? []).map(option => {
          const value = option.value ?? option.code ?? option.label ?? option.display;
          const isSelected = multiple ? Array.isArray(selected) && selected.includes(value) : selected === value;

          if (multiple) {
            return (
              <Checkbox
                key={`${field.id}-${value}`}
                value={isSelected}
                onValueChange={() => {
                  if (isReadOnly) return;
                  const next = Array.isArray(selected) ? [...selected] : [];
                  const idx = next.indexOf(value);
                  if (idx >= 0) {
                    next.splice(idx, 1);
                  } else {
                    next.push(value);
                  }
                  handleChange(field.id, next);
                }}
                label={option.label ?? option.display ?? value}
              />
            );
          }

            return (
              <TouchableOpacity
                key={`${field.id}-${value}`}
                style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                onPress={() => {
                  if (isReadOnly || disableSelection) return;
                  handleChange(field.id, value);
                }}>
                <View style={[styles.optionIndicator, isSelected && styles.optionIndicatorSelected]} />
                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                  {option.label ?? option.display ?? value}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderField = (field: FormField) => {
    const value = values[field.id];
    const error = errors[field.id];

    if (field.type === 'group') {
      const groupFields = Array.isArray((field as any).fields) ? (field as any).fields : [];
      return (
        <View key={field.id} style={styles.groupContainer}>
          <Text style={styles.groupLabel}>{field.label}</Text>
          <View style={styles.groupFields}>
            {groupFields.map((child: any) => renderField(child))}
          </View>
        </View>
      );
    }

    const hideInSignedView =
      isReadOnly &&
      entry.status === 'signed' &&
      (field.type === 'signature' || textIncludes(field.id, ['date']) || textIncludes(field.label, ['date']));
    if (hideInSignedView) {
      return null;
    }

    if (isReadOnly) {
      const displayValue = renderValueForDisplay(field, value);
      const displayWithFallback =
        displayValue === '—' ? cleanPlaceholder((field as any).placeholder) ?? displayValue : displayValue;
      const isCheckboxField = field.type === 'choice' || field.type === 'checkbox';
      // Render checkbox as a locked checkbox instead of a text input
      if (isCheckboxField) {
        const options = (field as any).options ?? [];
        const firstLabel =
          options[0]?.label ?? options[0]?.display ?? options[0]?.value ?? cleanLabel(field.label);
        const resolvedValue =
          value !== undefined && value !== null && `${value}` !== ''
            ? value
            : entry.status === 'signed'
              ? true
              : false;
        const checked = Array.isArray(resolvedValue)
          ? resolvedValue.length > 0
          : Boolean(resolvedValue);
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Checkbox value={checked} onValueChange={() => {}} label={firstLabel} disabled />
          </View>
        );
      }

      return (
        <View key={field.id} style={styles.fieldContainer}>
          <Input
            label={cleanLabel(field.label)}
            value={displayWithFallback}
            editable={false}
            multiline={field.type === 'textarea' || field.type === 'text'}
            inputStyle={field.type === 'textarea' ? styles.textArea : undefined}
            containerStyle={styles.readOnlyInputContainer}
          />
        </View>
      );
    }

    const labelText = cleanLabel(field.label);

    switch (field.type) {
      case 'input':
      case 'textarea':
      case 'number':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Input
              label={labelText}
              value={value ?? ''}
              placeholder={lockNonCheckboxInputs ? undefined : cleanPlaceholder((field as any).placeholder)}
              onChangeText={text => handleChange(field.id, text)}
              multiline={field.type === 'textarea'}
              keyboardType={field.type === 'number' ? 'numeric' : 'default'}
              inputStyle={field.type === 'textarea' ? styles.textArea : undefined}
              error={error}
              editable={!lockNonCheckboxInputs}
            />
          </View>
        );
      case 'boolean':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Checkbox
              value={Boolean(value)}
              onValueChange={next => handleChange(field.id, next)}
              label={field.label}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        );
      case 'dropdown':
      case 'radio':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.label}>{labelText}</Text>
            {renderChoiceOptions(field as any, false)}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        );
      case 'checkbox':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.label}>{labelText}</Text>
            {renderChoiceOptions(field as any, true)}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        );
      case 'date':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.label}>{labelText}</Text>
            <Text style={styles.dateValue}>{getDisplayDate(value) || getDisplayDate(new Date())}</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        );
      case 'signature':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.label}>{labelText}</Text>
            <Text style={styles.helperText}>Signature will be captured during signing.</Text>
          </View>
        );
      default:
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Input
              label={labelText}
              value={value ?? ''}
              placeholder={lockNonCheckboxInputs ? undefined : cleanPlaceholder((field as any).placeholder)}
              onChangeText={text => handleChange(field.id, text)}
              error={error}
              editable={!lockNonCheckboxInputs}
            />
          </View>
        );
    }
  };

  if (!entry && loading) {
    return (
      <LiquidGlassHeaderScreen
        header={<Header title="Form" showBackButton onBack={() => navigation.goBack()} glass={false} />}>
        {() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator />
          </View>
        )}
      </LiquidGlassHeaderScreen>
    );
  }

  if (!entry) {
    return (
      <LiquidGlassHeaderScreen
        header={<Header title="Form" showBackButton onBack={() => navigation.goBack()} glass={false} />}>
        {() => (
          <View style={styles.loadingContainer}>
            <Text style={styles.helperText}>Form is not available right now.</Text>
          </View>
        )}
      </LiquidGlassHeaderScreen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{flex: 1}}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <LiquidGlassHeaderScreen
          header={<Header title="Form" showBackButton onBack={() => navigation.goBack()} glass={false} />}
          contentPadding={theme.spacing['3']}>
          {contentPaddingStyle => (
            <ScrollView
              contentContainerStyle={[styles.container, contentPaddingStyle]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <View style={styles.formSurface}>
                <Text style={styles.title}>{entry.form.name}</Text>
                {entry.form.description ? <Text style={styles.description}>{entry.form.description}</Text> : null}

                <View style={styles.fieldsContainer}>
                  {entry.form.schema.map(field => renderField(field))}
                </View>

                {!isReadOnly ? (
                  <LiquidGlassButton
                    title={entry.signingRequired ? 'Submit & Continue' : 'Submit'}
                    onPress={handleSubmit}
                    height={56}
                    borderRadius={theme.borderRadius.lg}
                    textStyle={styles.buttonText}
                    tintColor={theme.colors.secondary}
                    disabled={submitting}
                    loading={submitting}
                  />
                ) : null}

                {isReadOnly && canStartSigning ? (
                  <LiquidGlassButton
                    title="View & Sign"
                    onPress={handleStartSigning}
                    height={56}
                    borderRadius={theme.borderRadius.lg}
                    textStyle={styles.buttonText}
                    tintColor={theme.colors.secondary}
                    disabled={signing}
                    loading={signing}
                  />
                ) : null}

                {entry.status === 'signed' && signedPdfUrl ? (
                  <LiquidGlassButton
                    title="View & Download"
                    onPress={handleOpenSignedPdf}
                    height={56}
                    borderRadius={theme.borderRadius.lg}
                    textStyle={styles.buttonText}
                    tintColor={theme.colors.secondary}
                    glassEffect="clear"
                    forceBorder
                    borderColor={theme.colors.secondary}
                  />
                ) : null}

                {entry.status === 'signed' && entry.submission?.submittedAt ? (
                  <View style={styles.signedBadge}>
                    <Text style={styles.signedBadgeText}>
                      Signed on {getDisplayDate(entry.submission.submittedAt)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>
          )}
        </LiquidGlassHeaderScreen>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const renderValueForDisplay = (field: FormField, value: any): string => {
  if (value === undefined || value === null) {
    return '—';
  }
  if (field.type === 'date') {
    return getDisplayDate(value) || '—';
  }
  if (field.type === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (Array.isArray(value)) {
    return value.map(v => `${v}`).join(', ') || '—';
  }
  if (field.type === 'choice' && !value) {
    const options = (field as any).options;
    if (options?.length) {
      return options.map((o: any) => o.label ?? o.display ?? o.value ?? '').filter(Boolean).join(', ') || '—';
    }
  }
  if (typeof value === 'object') {
    if ('url' in value && (value as any).url) {
      return (value as any).url;
    }
    return JSON.stringify(value);
  }
  return `${value}`;
};

const createStyles = (theme: any) => {
  const formStyles = createFormStyles(theme);
  return StyleSheet.create({
    container: {
      paddingBottom: theme.spacing['18'],
      paddingHorizontal: theme.spacing['2'],
      gap: theme.spacing['3'],
    },
    formSurface: {
      paddingHorizontal: theme.spacing['3'],
      paddingVertical: theme.spacing['4'],
      borderRadius: theme.borderRadius.lg,
      backgroundColor: 'transparent',
      borderWidth: 0,
      gap: theme.spacing['3'],
    },
    loadingContainer: {
      padding: theme.spacing['4'],
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      ...theme.typography.titleLarge,
      color: theme.colors.secondary,
    },
    description: {
      ...theme.typography.body14,
      color: theme.colors.textSecondary,
    },
    fieldsContainer: {
      gap: theme.spacing['3'],
      marginTop: theme.spacing['2'],
    },
    fieldContainer: {
      gap: theme.spacing['1'],
      marginBottom: theme.spacing['3'],
    },
    label: {
      ...theme.typography.labelSmall,
      color: theme.colors.secondary,
    },
    readOnlyValue: {
      ...theme.typography.body14,
      color: theme.colors.text,
    },
    readOnlyInputContainer: {
      backgroundColor: theme.colors.cardBackground,
    },
    textArea: formStyles.textArea,
    optionList: {
      gap: theme.spacing['2'],
    },
    optionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing['3'],
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
    },
    optionItemSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryTint,
    },
    optionIndicator: {
      width: theme.spacing['4'],
      height: theme.spacing['4'],
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.textSecondary,
      marginRight: theme.spacing['2'],
      backgroundColor: theme.colors.background,
    },
    optionIndicatorSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    optionLabel: {
      ...theme.typography.body14,
      color: theme.colors.secondary,
      flex: 1,
    },
    optionLabelSelected: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    dateInput: {
      padding: theme.spacing['3'],
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.cardBackground,
      gap: theme.spacing['1'],
    },
    dateValue: {
      ...theme.typography.body14,
      color: theme.colors.secondary,
    },
    helperText: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
    },
    errorText: formStyles.errorText,
    groupContainer: {
      padding: theme.spacing['3'],
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      borderRadius: theme.borderRadius.md,
      gap: theme.spacing['2'],
    },
    groupLabel: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
    },
    groupFields: {
      gap: theme.spacing['2'],
    },
    buttonText: {
      ...theme.typography.button,
      color: theme.colors.white,
    },
    signedBadge: {
      backgroundColor: theme.colors.successSurface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing['3'],
      marginTop: theme.spacing['4'],
      alignItems: 'center',
    },
    signedBadgeText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.success,
    },
  });
};

export default AppointmentFormScreen;
