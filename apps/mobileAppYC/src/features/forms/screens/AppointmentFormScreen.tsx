import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Linking,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
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
import {
  selectFormsForAppointment,
  selectFormsLoading,
  selectFormSubmitting,
  selectSigningStatus,
  submitAppointmentForm,
  startFormSigning,
  fetchAppointmentForms,
} from '@/features/forms';
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
  return value.replaceAll(/pet/gi, 'companion');
};

const cleanLabel = (value?: string | null): string | undefined => {
  if (!value) return value ?? undefined;
  return value.replaceAll(/pet/gi, 'Companion');
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
    appointment?.companionId
      ? state.companion.companions.find(c => c.id === appointment.companionId)
      : null,
  );
  const user = useSelector((state: RootState) => state.auth.user);
  const forms = useSelector((state: RootState) =>
    selectFormsForAppointment(state, appointmentId),
  );
  const entry = forms.find(item => item.form._id === formId);
  const loading = useSelector((state: RootState) =>
    selectFormsLoading(state, appointmentId),
  );
  const submitting = useSelector((state: RootState) =>
    selectFormSubmitting(state, formId),
  );
  const submissionId = entry?.submission?._id ?? null;
  const signing = useSelector((state: RootState) =>
    submissionId ? selectSigningStatus(state, submissionId) : false,
  );
  const signedPdfUrl = entry?.submission?.signing?.pdf?.url;

  const [values, setValues] = useState<Record<string, any>>(
    entry?.submission?.answers ?? {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  const isReadOnly = Boolean(
    entry?.submission &&
    (mode !== 'fill' ||
      entry.status === 'signed' ||
      entry.status === 'completed'),
  );
  const canStartSigning =
    allowSign &&
    entry?.signingRequired &&
    entry.submission &&
    entry.status !== 'signed';
  const lockNonCheckboxInputs = Boolean(allowSign);

  const headerSubtitle = useMemo(() => {
    const dateLabel = appointment?.date ? getDisplayDate(appointment.date) : '';
    const detail = [dateLabel, companion?.name].filter(Boolean).join(', ');
    return [appointment?.organisationName, detail ? `for ${detail}` : '']
      .filter(Boolean)
      .join(' · ');
  }, [appointment?.organisationName, appointment?.date, companion?.name]);

  const progress = useMemo(() => {
    const schema = entry?.form?.schema;
    if (!schema?.length) {
      return 0;
    }
    let total = 0;
    let filled = 0;
    const walk = (field: FormField) => {
      if (field.type === 'group') {
        const nested = (field as any).fields;
        if (Array.isArray(nested)) {
          nested.forEach(walk);
        }
        return;
      }
      if (field.type === 'signature') {
        return;
      }
      total += 1;
      if (isTruthy(values[field.id])) {
        filled += 1;
      }
    };
    schema.forEach(walk);
    return total ? Math.round((filled / total) * 100) : 0;
  }, [entry?.form?.schema, values]);

  useEffect(() => {
    setValues(entry?.submission?.answers ?? {});
    setIsDirty(false);
  }, [entry?.submission]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', e => {
      if (isReadOnly || !isDirty) {
        return;
      }
      e.preventDefault();
      Alert.alert(
        'Discard changes?',
        'Your answers have not been saved yet. If you leave now, they will be lost.',
        [
          {text: 'Keep Editing', style: 'cancel'},
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ],
      );
    });
    return () => unsubscribe();
  }, [navigation, isDirty, isReadOnly]);

  useEffect(() => {
    if (!entry?.form?.schema) {
      return;
    }
    const ownerFullName =
      [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
      user?.email ||
      '';
    const companionName = companion?.name ?? '';
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
        const isCheckboxField = field.type === 'checkbox';
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
          const placeholderVal =
            (field as any).placeholder ?? (field as any).text ?? '';
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
    companion?.name,
    entry?.form?.schema,
    entry?.submission,
    lockNonCheckboxInputs,
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
    setIsDirty(true);
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
    if (lockNonCheckboxInputs && field.type !== 'checkbox') {
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

  const handleSubmit = async () => {
    const activeEntry = entry as NonNullable<typeof entry>;
    const valid = validateForm();
    if (!valid) {
      return;
    }
    try {
      const result = await dispatch(
        submitAppointmentForm({
          appointmentId,
          form: activeEntry.form,
          answers: values,
          formVersion: activeEntry.formVersion,
          companionId: appointment?.companionId ?? null,
        }),
      ).unwrap();
      setIsDirty(false);

      if (activeEntry.signingRequired) {
        if (!result.submission?._id) {
          Alert.alert(
            'Signing not started',
            'Your answers were saved, but we could not start the signing process. Please try again from the appointment.',
          );
          navigation.goBack();
          return;
        }
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
              formTitle: activeEntry.form.name,
            });
            return;
          }
          Alert.alert(
            'Signing not started',
            'Your answers were saved, but we could not start the signing process. Please try again from the appointment.',
          );
        } catch (error: any) {
          const message =
            typeof error === 'string'
              ? error
              : (error?.message ?? 'Unable to start signing.');
          Alert.alert('Signing not started', message);
        }
      }

      navigation.goBack();
    } catch (error: any) {
      const message =
        typeof error === 'string'
          ? error
          : (error?.message ?? 'Unable to submit form. Please try again.');
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
          : (error?.message ?? 'Unable to start signing. Please try again.');
      Alert.alert('Signing failed', message);
    }
  };

  const handleOpenSignedPdf = React.useCallback(() => {
    Linking.openURL(signedPdfUrl as string).catch(() => {
      Alert.alert('Unable to open PDF', 'Please try again in a moment.');
    });
  }, [signedPdfUrl]);

  const buildChoiceOptions = (
    field: FormField & {options?: any[]},
    multiple: boolean,
  ) => {
    const disableSelection = lockNonCheckboxInputs && !multiple;
    const selected = values[field.id];
    const selectedSet =
      multiple && Array.isArray(selected) ? new Set(selected) : null;
    return (
      <View style={styles.optionList}>
        {(field.options ?? []).map(option => {
          const value =
            option.value ?? option.code ?? option.label ?? option.display;
          const isSelected = multiple
            ? selectedSet?.has(value) === true
            : selected === value;

          if (multiple) {
            return (
              <Checkbox
                key={`${field.id}-${value}`}
                value={isSelected}
                onValueChange={() => {
                  /* istanbul ignore next -- read-only checkboxes render through renderReadOnlyCheckbox instead. */
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
            <PressableOpacity
              key={`${field.id}-${value}`}
              accessibilityRole="radio"
              accessibilityState={{selected: isSelected}}
              style={[
                styles.optionItem,
                isSelected && styles.optionItemSelected,
              ]}
              onPress={() => {
                if (isReadOnly || disableSelection) return;
                handleChange(field.id, value);
              }}>
              <View
                style={[
                  styles.optionIndicator,
                  isSelected && styles.optionIndicatorSelected,
                ]}>
                {isSelected ? <View style={styles.optionInnerDot} /> : null}
              </View>
              <Text
                style={[
                  styles.optionLabel,
                  isSelected && styles.optionLabelSelected,
                ]}>
                {option.label ?? option.display ?? value}
              </Text>
            </PressableOpacity>
          );
        })}
      </View>
    );
  };

  const renderReadOnlyCheckbox = (field: FormField, value: any) => {
    const options = (field as any).options ?? [];
    const firstLabel =
      options[0]?.label ??
      options[0]?.display ??
      options[0]?.value ??
      cleanLabel(field.label);
    let resolvedValue;
    if (value !== undefined && value !== null && `${value}` !== '') {
      resolvedValue = value;
    } else if (entry?.status === 'signed') {
      resolvedValue = true;
    } else {
      resolvedValue = false;
    }
    const checked = Array.isArray(resolvedValue)
      ? resolvedValue.length > 0
      : Boolean(resolvedValue);
    return (
      <View key={field.id} style={styles.fieldContainer}>
        <Checkbox value={checked} onValueChange={() => {}} label={firstLabel} />
      </View>
    );
  };

  const renderReadOnlyField = (field: FormField, value: any) => {
    const displayValue = renderValueForDisplay(field, value);
    const displayWithFallback =
      displayValue === '—'
        ? (cleanPlaceholder((field as any).placeholder) ?? displayValue)
        : displayValue;
    const isCheckboxField = field.type === 'checkbox';

    if (isCheckboxField) {
      return renderReadOnlyCheckbox(field, value);
    }

    return (
      <View key={field.id} style={styles.fieldContainer}>
        <Input
          label={cleanLabel(field.label)}
          value={displayWithFallback}
          editable={false}
          multiline={field.type === 'textarea'}
          inputStyle={field.type === 'textarea' ? styles.textArea : undefined}
          containerStyle={styles.readOnlyInputContainer}
        />
      </View>
    );
  };

  const renderEditableField = (field: FormField, value: any, error: string) => {
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
              placeholder={
                lockNonCheckboxInputs
                  ? undefined
                  : cleanPlaceholder((field as any).placeholder)
              }
              onChangeText={text => handleChange(field.id, text)}
              multiline={field.type === 'textarea'}
              keyboardType={field.type === 'number' ? 'numeric' : 'default'}
              inputStyle={
                field.type === 'textarea' ? styles.textArea : undefined
              }
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
            {buildChoiceOptions(field as any, false)}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        );
      case 'checkbox':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.label}>{labelText}</Text>
            {buildChoiceOptions(field as any, true)}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        );
      case 'date':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Input
              label={labelText}
              value={getDisplayDate(value)}
              editable={false}
              placeholder="Select date"
            />
          </View>
        );
      case 'signature':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.label}>{labelText}</Text>
            <Text style={styles.helperText}>
              Signature will be captured during the signing process
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  const renderField = (field: FormField) => {
    const value = values[field.id];
    const error = errors[field.id];

    if (field.type === 'group') {
      const groupFields = Array.isArray((field as any).fields)
        ? (field as any).fields
        : [];
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
      entry?.status === 'signed' &&
      (field.type === 'signature' ||
        textIncludes(field.id, ['date']) ||
        textIncludes(field.label, ['date']));
    if (hideInSignedView) {
      return null;
    }

    if (isReadOnly) {
      return renderReadOnlyField(field, value);
    }

    return renderEditableField(field, value, error);
  };

  if (!entry && loading) {
    return (
      <LiquidGlassHeaderScreen
        header={
          <Header
            title="Form"
            showBackButton
            onBack={() => navigation.goBack()}
            glass={false}
          />
        }>
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
        header={
          <Header
            title="Form"
            showBackButton
            onBack={() => navigation.goBack()}
            glass={false}
          />
        }>
        {() => (
          <View style={styles.loadingContainer}>
            <Text style={styles.helperText}>
              Form is not available right now.
            </Text>
          </View>
        )}
      </LiquidGlassHeaderScreen>
    );
  }

  const headerNode = (
    <View style={styles.header}>
      <PressableOpacity
        testID="header-back"
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={styles.circleButton}
        onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={18} color={theme.colors.inkBody} />
      </PressableOpacity>

      <View style={styles.headerTitleBlock}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {entry.form.name}
        </Text>
        {headerSubtitle ? (
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {headerSubtitle}
          </Text>
        ) : null}
      </View>

      {isReadOnly ? (
        <View style={styles.circleButton} />
      ) : (
        <View style={styles.headerRightSlot}>
          <Text style={styles.headerStepText}>{`${progress}%`}</Text>
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}>
      <PressableOpacity
        activeOpacity={1}
        onPress={Keyboard.dismiss}
        accessible={false}>
        <LiquidGlassHeaderScreen
          header={headerNode}
          contentPadding={theme.spacing['3']}>
          {contentPaddingStyle => (
            <View style={styles.flex}>
              {isReadOnly ? null : (
                <View style={styles.progressWrap}>
                  <View style={styles.progressTrack}>
                    <View
                      style={[styles.progressFill, {width: `${progress}%`}]}
                    />
                  </View>
                </View>
              )}

              <ScrollView
                contentContainerStyle={[styles.container, contentPaddingStyle]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}>
                <View style={styles.formSurface}>
                  {entry.form.description ? (
                    <Text style={styles.description}>
                      {entry.form.description}
                    </Text>
                  ) : null}

                  <View style={styles.fieldsContainer}>
                    {(entry.form.schema ?? []).map(field => renderField(field))}
                  </View>

                  {isReadOnly ? null : (
                    <View style={styles.helperBanner}>
                      <Ionicons
                        name="alert-circle-outline"
                        size={16}
                        color={theme.colors.blueText}
                      />
                      <Text style={styles.helperBannerText}>
                        Answers are only saved when you submit. Leaving before
                        then will discard your progress.
                      </Text>
                    </View>
                  )}

                  {entry.status === 'signed' &&
                  entry.submission?.submittedAt ? (
                    <View style={styles.signedBadge}>
                      <Text style={styles.signedBadgeText}>
                        Signed on {getDisplayDate(entry.submission.submittedAt)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </ScrollView>

              <View style={styles.footer}>
                <PressableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  style={styles.footerBackBtn}
                  onPress={() => navigation.goBack()}>
                  <Text style={styles.footerBackText}>Back</Text>
                </PressableOpacity>

                <View style={styles.footerPrimarySlot}>
                  {isReadOnly ? null : (
                    <LiquidGlassButton
                      title={
                        entry.signingRequired ? 'Submit & Continue' : 'Submit'
                      }
                      onPress={handleSubmit}
                      height={56}
                      borderRadius={theme.borderRadius.button}
                      textStyle={styles.buttonText}
                      tintColor={theme.colors.cta}
                      shadowIntensity="medium"
                      disabled={submitting}
                      loading={submitting}
                    />
                  )}

                  {isReadOnly && canStartSigning ? (
                    <LiquidGlassButton
                      title="View & Sign"
                      onPress={handleStartSigning}
                      height={56}
                      borderRadius={theme.borderRadius.button}
                      textStyle={styles.buttonText}
                      tintColor={theme.colors.cta}
                      shadowIntensity="medium"
                      disabled={signing}
                      loading={signing}
                    />
                  ) : null}

                  {entry.status === 'signed' && signedPdfUrl ? (
                    <LiquidGlassButton
                      title="View & Download"
                      onPress={handleOpenSignedPdf}
                      height={56}
                      borderRadius={theme.borderRadius.button}
                      textStyle={styles.secondaryButtonText}
                      glassEffect="clear"
                      forceBorder
                      borderColor={theme.colors.divider}
                    />
                  ) : null}
                </View>
              </View>
            </View>
          )}
        </LiquidGlassHeaderScreen>
      </PressableOpacity>
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
  if (field.type === 'checkbox' && !value) {
    const options = (field as any).options;
    if (options?.length) {
      return (
        options
          .flatMap((o: any) => {
            const v = o.label ?? o.display ?? o.value;
            return v ? [v] : [];
          })
          .join(', ') || '—'
      );
    }
  }
  if (typeof value === 'object') {
    if ('url' in value && value.url) {
      return String(value.url);
    }
    return JSON.stringify(value);
  }
  return `${value}`;
};

const createStyles = (theme: any) => {
  const formStyles = createFormStyles(theme);
  return StyleSheet.create({
    keyboardAvoidingView: {
      flex: 1,
    },
    flex: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
      paddingHorizontal: theme.spacing['5'],
      paddingVertical: theme.spacing['2'],
    },
    circleButton: {
      width: theme.spacing['10'],
      height: theme.spacing['10'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.screen2,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitleBlock: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      ...theme.typography.labelSmall,
      fontSize: 15.5,
      fontWeight: '600',
      letterSpacing: -0.2,
      color: theme.colors.ink,
      textAlign: 'center',
    },
    headerSubtitle: {
      ...theme.typography.body12,
      color: theme.colors.inkFaint,
      textAlign: 'center',
      marginTop: 1,
    },
    headerRightSlot: {
      width: theme.spacing['10'],
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    headerStepText: {
      ...theme.typography.subtitleBold12,
      fontSize: 12.5,
      fontWeight: '700',
      color: theme.colors.inkFaint,
    },
    progressWrap: {
      paddingHorizontal: theme.spacing['5'],
      marginTop: theme.spacing['3.5'],
    },
    progressTrack: {
      height: 6,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inset,
      overflow: 'hidden',
    },
    progressFill: {
      height: 6,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.blue,
    },
    container: {
      paddingTop: theme.spacing['3.5'],
      paddingBottom: theme.spacing['6'],
      paddingHorizontal: theme.spacing['2'],
      gap: theme.spacing['3.5'],
    },
    formSurface: {
      paddingHorizontal: theme.spacing['3'],
      backgroundColor: 'transparent',
      borderWidth: 0,
      gap: theme.spacing['3.5'],
    },
    loadingContainer: {
      padding: theme.spacing['4'],
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      ...theme.typography.serifTitleSmall,
      color: theme.colors.ink,
    },
    description: {
      ...theme.typography.body14,
      color: theme.colors.inkMuted,
    },
    fieldsContainer: {
      gap: theme.spacing['3.5'],
    },
    fieldContainer: {
      gap: theme.spacing['2'],
      marginBottom: theme.spacing['1'],
    },
    label: {
      ...theme.typography.pillSubtitleBold15,
      fontSize: 14.5,
      lineHeight: 18,
      fontWeight: '700',
      color: theme.colors.ink,
      marginBottom: theme.spacing['1'],
    },
    readOnlyValue: {
      ...theme.typography.body14,
      color: theme.colors.text,
    },
    readOnlyInputContainer: {
      backgroundColor: theme.colors.fieldBg,
    },
    textArea: formStyles.textArea,
    optionList: {
      gap: theme.spacing['2.5'],
    },
    optionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 50,
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['3'],
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      borderRadius: theme.borderRadius.field,
      backgroundColor: theme.colors.screen2,
    },
    optionItemSelected: {
      borderWidth: 1.5,
      borderColor: theme.colors.blue,
      backgroundColor: theme.colors.screen,
      boxShadow: `0px 0px 0px 3px ${theme.colors.primaryTint}`,
    },
    optionIndicator: {
      width: 20,
      height: 20,
      borderRadius: theme.borderRadius.full,
      borderWidth: 2,
      borderColor: theme.colors.divider,
      marginRight: theme.spacing['2.5'],
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.transparent,
    },
    optionIndicatorSelected: {
      borderColor: theme.colors.blue,
    },
    optionInnerDot: {
      width: 8,
      height: 8,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.blue,
    },
    optionLabel: {
      ...theme.typography.body14,
      fontSize: 14.5,
      color: theme.colors.inkMuted,
      flex: 1,
    },
    optionLabelSelected: {
      color: theme.colors.ink,
      fontWeight: '700',
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
      color: theme.colors.inkMuted,
    },
    errorText: formStyles.errorText,
    helperBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing['2'],
      padding: theme.spacing['3'],
      borderRadius: theme.borderRadius.field,
      backgroundColor: theme.colors.blueSoft,
    },
    helperBannerText: {
      ...theme.typography.body13,
      color: theme.colors.blueText,
      flex: 1,
    },
    groupContainer: {
      padding: theme.spacing['4'],
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      borderRadius: theme.borderRadius.card,
      backgroundColor: theme.colors.screen2,
      gap: theme.spacing['3'],
    },
    groupLabel: {
      ...theme.typography.titleSmall,
      color: theme.colors.ink,
    },
    groupFields: {
      gap: theme.spacing['3'],
    },
    footer: {
      flexDirection: 'row',
      gap: theme.spacing['2.5'],
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['3.5'],
      paddingBottom: theme.spacing['6'],
      backgroundColor: theme.colors.background,
    },
    footerBackBtn: {
      flex: 1,
      height: 56,
      borderRadius: theme.borderRadius.button,
      borderWidth: 1,
      borderColor: theme.colors.divider,
      backgroundColor: theme.colors.transparent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footerBackText: {
      ...theme.typography.button,
      color: theme.colors.inkBody,
    },
    footerPrimarySlot: {
      flex: 2,
    },
    buttonText: {
      ...theme.typography.button,
      color: theme.colors.ctaText,
    },
    secondaryButtonText: {
      ...theme.typography.button,
      color: theme.colors.inkBody,
    },
    signedBadge: {
      backgroundColor: theme.colors.successSurface,
      borderRadius: theme.borderRadius.field,
      padding: theme.spacing['3'],
      marginTop: theme.spacing['1'],
      alignItems: 'center',
    },
    signedBadgeText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.success,
    },
  });
};

export default AppointmentFormScreen;
