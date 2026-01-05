import React, {useMemo, useState, useEffect, useCallback, useRef} from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
  type NavigationProp,
} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';

import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '@/hooks';
import type {RootState, AppDispatch} from '@/app/store';
import type {TaskStackParamList, TabParamList} from '@/navigation/types';
import {Images} from '@/assets/images';
import {observationalToolDefinitions} from '@/features/observationalTools/data';
import type {
  ObservationalToolBookingContext,
  ObservationalToolStep,
  ObservationalToolOption,
  ObservationalToolResponses,
} from '@/features/observationalTools/types';
import {selectTaskById} from '@/features/tasks/selectors';
import type {ObservationalToolTaskDetails} from '@/features/tasks/types';
import {fetchBusinesses} from '@/features/appointments/businessesSlice';
import {resolveObservationalToolLabel} from '@/features/tasks/utils/taskLabels';
import {setSelectedCompanion} from '@/features/companion';
import type {VetBusiness} from '@/features/appointments/types';
import {selectAuthUser} from '@/features/auth/selectors';
import {
  DiscardChangesBottomSheet,
  DiscardChangesBottomSheetRef,
} from '@/shared/components/common/DiscardChangesBottomSheet/DiscardChangesBottomSheet';
import {
  getCachedObservationTool,
  observationToolApi,
  type ObservationToolField,
  type ObservationToolDefinitionRemote,
} from '@/features/observationalTools/services/observationToolService';
import {useBusinessPhotoFallback} from '@/features/appointments/hooks/useBusinessPhotoFallback';
import {isDummyPhoto} from '@/features/appointments/utils/photoUtils';
import {normalizeImageUri} from '@/shared/utils/imageUri';
import {resolveImageSource} from '@/shared/utils/resolveImageSource';

const normalizeToken = (value?: string | null) =>
  (value ?? '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, '');

const normalizeName = (value?: string | null) => normalizeToken(value);

const findMatchingField = (
  fields: ObservationToolField[],
  step: ObservationalToolStep,
): ObservationToolField | null => {
  const stepTokens = [step.id, step.title].map(normalizeToken).filter(Boolean);
  const exactMatch = fields.find(field => {
    const fieldTokens = [field.key, field.label].map(normalizeToken).filter(Boolean);
    return fieldTokens.some(token => stepTokens.includes(token));
  });
  if (exactMatch) return exactMatch;
  const fuzzyMatch = fields.find(field => {
    const fieldTokens = [field.key, field.label].map(normalizeToken).filter(Boolean);
    return fieldTokens.some(token =>
      stepTokens.some(stepToken => stepToken.includes(token) || token.includes(stepToken)),
    );
  });
  return fuzzyMatch ?? null;
};

type Navigation = NativeStackNavigationProp<TaskStackParamList, 'ObservationalTool'>;
type Route = RouteProp<TaskStackParamList, 'ObservationalTool'>;

interface ProviderEntry {
  businessId: string;
  serviceId: string;
  specialityId?: string | null;
  serviceName: string;
  serviceSpecialty?: string | null;
  name: string;
  subtitle?: string;
  description?: string;
  image?: any;
  fallbackImage?: any;
  googlePlacesId?: string | null;
  appointmentFee?: number | null;
}

export const ObservationalToolScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const scrollViewRef = useRef<ScrollView>(null);
  const discardSheetRef = useRef<DiscardChangesBottomSheetRef>(null);

  const {taskId} = route.params;

  const task = useSelector((state: RootState) => selectTaskById(taskId)(state));
  const currentUser = useSelector(selectAuthUser);
  const companion = useSelector((state: RootState) =>
    task ? state.companion.companions.find(c => c.id === task.companionId) : null,
  );
  const businesses = useSelector((state: RootState) => state.businesses.businesses);
  const services = useSelector((state: RootState) => state.businesses.services);
  const {businessFallbacks, requestBusinessPhoto, handleAvatarError} =
    useBusinessPhotoFallback();

  useEffect(() => {
    if (!businesses.length || !services.length) {
      dispatch(fetchBusinesses());
    }
  }, [dispatch, businesses.length, services.length]);

  const [stage, setStage] = useState<'landing' | 'form'>('landing');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [responses, setResponses] = useState<ObservationalToolResponses>({});
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [providerTouched, setProviderTouched] = useState(false);
  const [stepTouched, setStepTouched] = useState(false);
  const [definitionLoading, setDefinitionLoading] = useState(false);
  const [remoteDefinition, setRemoteDefinition] = useState<ObservationToolDefinitionRemote | null>(null);
  const [companionImageError, setCompanionImageError] = useState(false);
  const scrollToTop = useCallback(() => {
    scrollViewRef.current?.scrollTo({y: 0, animated: true});
  }, []);

  const details = task?.details
    ? (task.details as ObservationalToolTaskDetails)
    : null;

  const toolId = details?.toolType ?? task?.observationToolId ?? null;

  useEffect(() => {
    let isMounted = true;
    if (!toolId) return;
    const cached = getCachedObservationTool(toolId);
    if (cached) {
      setRemoteDefinition(cached);
      return;
    }
    const fetchDefinition = async () => {
      try {
        setDefinitionLoading(true);
        const def = await observationToolApi.get(toolId);
        if (isMounted) {
          setRemoteDefinition(def);
        }
      } catch (error) {
        console.warn('[ObservationalTool] Failed to load definition', error);
      } finally {
        if (isMounted) {
          setDefinitionLoading(false);
        }
      }
    };
    fetchDefinition();
    return () => {
      isMounted = false;
    };
  }, [toolId]);

  const toolLabel = toolId
    ? resolveObservationalToolLabel(toolId)
    : 'Observational tool';

  const inferSpeciesFromName = useCallback((name?: string | null) => {
    const normalized = (name ?? '').toLowerCase();
    if (normalized.includes('feline') || normalized.includes('cat')) return 'cat';
    if (normalized.includes('canine') || normalized.includes('dog')) return 'dog';
    if (normalized.includes('equine') || normalized.includes('horse')) return 'horse';
    return null;
  }, []);

  const staticDefinition = useMemo(() => {
    if (toolId && (observationalToolDefinitions as Record<string, any>)[toolId]) {
      return (observationalToolDefinitions as Record<string, any>)[toolId];
    }
    const normalizedRemote = normalizeName(remoteDefinition?.name);
    const byName = Object.values(observationalToolDefinitions).find(def => {
      const normalizedDef = normalizeName(def.name);
      const normalizedShort = normalizeName(def.shortName);
      return (
        normalizedDef === normalizedRemote ||
        normalizedShort === normalizedRemote ||
        (normalizedRemote?.includes(normalizedDef)) ||
        (normalizedDef && normalizedRemote?.includes(normalizedDef))
      );
    });
    if (byName) return byName;
    const fallbackBySpecies = (species: string | null) => {
      if (species === 'cat') return observationalToolDefinitions['feline-grimace-scale'];
      if (species === 'dog') return observationalToolDefinitions['canine-acute-pain-scale'];
      if (species === 'horse') return observationalToolDefinitions['equine-grimace-scale'];
      return null;
    };
    const inferredSpecies = inferSpeciesFromName(remoteDefinition?.name) ?? companion?.category ?? null;
    return fallbackBySpecies(inferredSpecies);
  }, [companion?.category, inferSpeciesFromName, remoteDefinition?.name, toolId]);

  const displayDefinition = useMemo(() => {
    const fallbackEmpty = {
      title: 'No providers found nearby',
      message:
        'We could not find any nearby providers for this observational tool yet. Please try again later.',
      image: Images.otNoProviders,
    };

    const overviewParagraphs = staticDefinition?.overviewParagraphs ??
      (remoteDefinition?.description
        ? [remoteDefinition.description]
        : ['Answer a quick checklist to help your care team understand how your companion is doing today.']);

    return {
      name: remoteDefinition?.name ?? staticDefinition?.name ?? toolLabel,
      overviewTitle: staticDefinition?.overviewTitle ?? remoteDefinition?.name ?? toolLabel,
      overviewParagraphs,
      subtitle: staticDefinition?.steps?.[0]?.subtitle ?? remoteDefinition?.description ?? '',
      footer: staticDefinition?.steps?.[0]?.footerNote ?? '',
      emptyState: staticDefinition?.emptyState ?? fallbackEmpty,
      heroImage: staticDefinition?.heroImage,
    };
  }, [remoteDefinition?.description, remoteDefinition?.name, staticDefinition, toolLabel]);

  const getFieldOptions = (field: ObservationToolField) => {
    if (Array.isArray(field.options) && field.options.length > 0) {
      return field.options.map(option => ({id: option, title: option}));
    }
    if (field.type === 'BOOLEAN') {
      return [
        {id: 'Yes', title: 'Yes'},
        {id: 'No', title: 'No'},
      ];
    }
    return [];
  };

  const steps = useMemo<ObservationalToolStep[]>(() => {
    if (staticDefinition) {
      const fields = remoteDefinition?.fields ?? [];
      return staticDefinition.steps.map((step: ObservationalToolStep, index: number) => {
        const matchedField =
          (fields.length ? findMatchingField(fields, step) : null) ??
          (fields.length === staticDefinition.steps.length ? fields[index] : null);
        const mappedOptions =
          matchedField?.options?.length
            ? matchedField.options.map((backendOption, optionIdx) => {
                const fallbackOption = step.options[optionIdx];
                return {
                  id: backendOption,
                  title: backendOption,
                  subtitle: fallbackOption?.subtitle,
                  image: fallbackOption?.image,
                };
              })
            : step.options;
        return {
          ...step,
          subtitle: step.subtitle || displayDefinition.subtitle || '',
          footerNote: step.footerNote ?? displayDefinition.footer ?? undefined,
          required: matchedField?.required ?? step.required,
          options: mappedOptions,
        };
      });
    }
    if (remoteDefinition) {
      return remoteDefinition.fields.map(field => ({
        id: field.key,
        title: field.label ?? field.key,
        subtitle: displayDefinition.subtitle ?? '',
        helperText: undefined,
        heroImage: undefined,
        footerNote: displayDefinition.footer ?? undefined,
        options: getFieldOptions(field),
        required: field.required ?? false,
      }));
    }
    return staticDefinition ? staticDefinition.steps : [];
  }, [
    displayDefinition.footer,
    displayDefinition.subtitle,
    remoteDefinition,
    staticDefinition,
  ]);

  const submissionKeyByStepId = useMemo(() => {
    if (!staticDefinition || !remoteDefinition?.fields?.length) {
      return {} as Record<string, string>;
    }
    const mapping: Record<string, string> = {};
    staticDefinition.steps.forEach((step: ObservationalToolStep, index: number) => {
      const matchedField =
        findMatchingField(remoteDefinition.fields, step) ??
        (remoteDefinition.fields.length === staticDefinition.steps.length
          ? remoteDefinition.fields[index]
          : null);
      if (matchedField?.key) {
        mapping[step.id] = matchedField.key;
      }
    });
    return mapping;
  }, [remoteDefinition?.fields, staticDefinition]);

  const resolveBusinessDescription = useCallback((biz: VetBusiness) => {
    if (biz.description && biz.description.trim().length > 0) {
      return biz.description.trim();
    }
    if (biz.openHours && biz.openHours.trim().length > 0) {
      return biz.openHours.trim();
    }
    return null;
  }, []);

  const toolDisplayName = remoteDefinition?.name ?? staticDefinition?.name ?? toolLabel;
  const toolSpecies = inferSpeciesFromName(toolDisplayName) ?? companion?.category ?? null;

  const otServices = useMemo(() => {
    const normalizedName = (toolDisplayName ?? '').toLowerCase();
    const speciesToken = (toolSpecies ?? '').toLowerCase();
    return services.filter(service => {
      const specialtyMatch = (service.specialty ?? '').toLowerCase().includes('observation');
      const nameMatch = normalizedName ? service.name.toLowerCase().includes(normalizedName) : false;
      const speciesMatch = speciesToken ? service.name.toLowerCase().includes(speciesToken) : true;
      return specialtyMatch && (nameMatch || speciesMatch || !normalizedName);
    });
  }, [services, toolDisplayName, toolSpecies]);

  const providerEntries: ProviderEntry[] = useMemo(() => {
    const entries = otServices
      .map(service => {
        const biz = businesses.find(b => b.id === service.businessId);
        if (!biz) return null;
        const fallbackPhoto = businessFallbacks[biz.id]?.photo;
        return {
          businessId: biz.id,
          serviceId: service.id,
          specialityId: service.specialityId ?? null,
          serviceName: service.name,
          serviceSpecialty: service.specialty ?? null,
          name: biz.name,
          subtitle: biz.address,
          description: resolveBusinessDescription(biz),
          image: biz.photo,
          fallbackImage: fallbackPhoto ?? null,
          googlePlacesId: biz.googlePlacesId ?? null,
          appointmentFee: service.basePrice ?? null,
        } as ProviderEntry;
      })
      .filter((entry): entry is ProviderEntry => !!entry);

    const currentUserId = currentUser?.parentId ?? currentUser?.id ?? null;
    if (task?.createdBy && currentUserId && task.createdBy !== currentUserId) {
      const matched = entries.filter(entry => entry.businessId === task.createdBy);
      if (matched.length > 0) {
        return matched;
      }
    }

    return entries;
  }, [
    businessFallbacks,
    businesses,
    currentUser?.id,
    currentUser?.parentId,
    otServices,
    resolveBusinessDescription,
    task?.createdBy,
  ]);

  useEffect(() => {
    providerEntries.forEach(entry => {
      if (typeof entry.image === 'number') {
        return;
      }
      const imageUri = typeof entry.image === 'string' ? entry.image : entry.image?.uri ?? null;
      if ((!imageUri || isDummyPhoto(imageUri)) && entry.googlePlacesId) {
        requestBusinessPhoto(entry.googlePlacesId, entry.businessId);
      }
    });
  }, [providerEntries, requestBusinessPhoto]);

  useEffect(() => {
    if (!selectedProviderId && providerEntries.length === 1) {
      setSelectedProviderId(providerEntries[0].businessId);
    }
  }, [providerEntries, selectedProviderId]);

  const totalSteps = steps.length;
  const effectiveStepIndex =
    totalSteps > 0 ? Math.min(currentStepIndex, totalSteps - 1) : 0;
  const currentStep = totalSteps > 0 ? steps[effectiveStepIndex] : null;
  const selectionsForStep = (() => {
    if (!currentStep) return [];
    const value = responses[currentStep.id];
    if (Array.isArray(value)) return value;
    return value ? [value] : [];
  })();
  const isStepCompleted = currentStep ? (!currentStep.required || selectionsForStep.length > 0) : false;
  const isImageOptionLayout =
    currentStep?.options?.some(option => option.image) ?? false;

  useEffect(() => {
    scrollToTop();
  }, [scrollToTop, stage, effectiveStepIndex]);

  const handleHeaderBack = () => {
    discardSheetRef.current?.open();
  };

  // Access parent tab navigator early for typed navigation between tabs
  const tabNavigation = navigation.getParent<NavigationProp<TabParamList>>();

  const handleSafeExit = useCallback(() => {
    // If OT was opened as the first (only) route inside the Tasks stack
    // (e.g., launched directly from Home), reset the Tasks stack to TasksMain
    // BEFORE leaving the tab so the next visit to Tasks is not stuck on OT.
    const state = navigation.getState() as any;
    const isFirstInTaskStack = state?.routes && state.routes.length <= 1;

    if (isFirstInTaskStack) {
      navigation.reset({index: 0, routes: [{name: 'TasksMain'}]});
      // And move back to Home tab explicitly
      tabNavigation?.navigate('HomeStack', {screen: 'Home'} as any);
      return;
    }

    // Normal in-stack back if there is history within Tasks stack
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    // Fallback: ensure Tasks stack points to TasksMain
    navigation.reset({index: 0, routes: [{name: 'TasksMain'}]});
    tabNavigation?.navigate('Tasks', {screen: 'TasksMain'});
  }, [navigation, tabNavigation]);

  const handleDiscardChanges = useCallback(() => {
    handleSafeExit();
  }, [handleSafeExit]);

  const handleStepBack = () => {
    if (stage !== 'form') {
      return;
    }

    if (effectiveStepIndex > 0) {
      setCurrentStepIndex(prev => Math.max(prev - 1, 0));
      setStepTouched(false);
      return;
    }

    setStage('landing');
    setStepTouched(false);
  };

  const companionImageUri = useMemo(
    () => normalizeImageUri(companion?.profileImage ?? null),
    [companion?.profileImage],
  );
  const companionImageSource = useMemo(
    () => (companionImageUri && !companionImageError ? {uri: companionImageUri} : null),
    [companionImageError, companionImageUri],
  );

  useEffect(() => {
    setCompanionImageError(false);
  }, [companionImageUri]);

  const companionInitial = useMemo(() => {
    const nameSource = companion?.name ?? toolLabel;
    return nameSource ? nameSource.charAt(0).toUpperCase() : '?';
  }, [companion?.name, toolLabel]);

  const toggleProvider = (businessId: string) => {
    setProviderTouched(true);
    setSelectedProviderId(prev => (prev === businessId ? null : businessId));
  };

  const toggleOption = (stepId: string, optionId: string) => {
    setStepTouched(true);
    setResponses(prev => {
      return {...prev, [stepId]: [optionId]};
    });
  };

  const goToNextStep = () => {
    if (!isStepCompleted) {
      setStepTouched(true);
      return;
    }
    if (effectiveStepIndex < totalSteps - 1) {
      setCurrentStepIndex(prev => Math.min(prev + 1, totalSteps - 1));
      setStepTouched(false);
    }
  };

  const startAssessment = () => {
    if (providerEntries.length > 0 && !selectedProviderId) {
      setProviderTouched(true);
      return;
    }
    setStage('form');
  };

  const resolvedProvider = useMemo<ProviderEntry | null>(() => {
    if (!providerEntries.length) {
      return null;
    }
    if (selectedProviderId) {
      const selected = providerEntries.find(entry => entry.businessId === selectedProviderId);
      if (selected) return selected;
    }
    return providerEntries[0] ?? null;
  }, [providerEntries, selectedProviderId]);

  const handleSubmit = useCallback(async () => {
    if (!task || !details) {
      return;
    }

    if (providerEntries.length > 0 && !selectedProviderId) {
      setProviderTouched(true);
      return;
    }

    if (!resolvedProvider && providerEntries.length) {
      setProviderTouched(true);
      return;
    }

    if (!resolvedProvider) {
      Alert.alert('Provider required', 'Please select a provider offering this observational tool.');
      return;
    }

    const missingRequired = steps.some(step => {
      if (!step.required) return false;
      const value = responses[step.id];
      const selected = Array.isArray(value) ? value[0] : value;
      return !selected;
    });

    if (missingRequired) {
      setStepTouched(true);
      return;
    }

    const answers = steps.reduce<Record<string, unknown>>((acc, step) => {
      const value = responses[step.id];
      const selected = Array.isArray(value) ? value[0] : value;
      if (selected !== undefined && selected !== null) {
        const submissionKey = submissionKeyByStepId[step.id] ?? step.id;
        acc[submissionKey] = selected;
      }
      return acc;
    }, {});

    try {
      const submissionToolId =
        task.observationToolId ?? details.toolType ?? remoteDefinition?.id ?? toolId ?? '';
      const submission = await observationToolApi.submit({
        toolId: submissionToolId,
        companionId: companion?.id ?? task.companionId,
        taskId: task.id,
        answers,
      });

      if (companion) {
        dispatch(setSelectedCompanion(companion.id));
      }

      const appointmentType = 'Observational Tool';
      const otContext: ObservationalToolBookingContext = {
        toolId: remoteDefinition?.id ?? details.toolType,
        provider: resolvedProvider as any,
        responses: responses as any,
        submissionId: submission?.id,
      };

      tabNavigation?.navigate('Appointments', {
        screen: 'BookingForm',
        params: {
          businessId: resolvedProvider?.businessId ?? providerEntries[0]?.businessId,
          serviceId: resolvedProvider?.serviceId ?? providerEntries[0]?.serviceId,
          serviceName: resolvedProvider?.serviceName ?? toolDisplayName,
          serviceSpecialty: resolvedProvider?.serviceSpecialty ?? 'Observational Tool',
          serviceSpecialtyId: resolvedProvider?.specialityId ?? null,
          employeeId: undefined,
          appointmentType,
          otContext,
        },
      } as any);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit responses';
      Alert.alert('Submission failed', message);
    }
  }, [
    companion,
    details,
    dispatch,
    providerEntries,
    remoteDefinition?.id,
    resolvedProvider,
    responses,
    selectedProviderId,
    steps,
    submissionKeyByStepId,
    tabNavigation,
    task,
    toolDisplayName,
    toolId,
  ]);

  if (!task || !details) {
    return (
      <LiquidGlassHeaderScreen
        header={
          <Header
            title="Observational Tool"
            showBackButton
            onBack={() => navigation.goBack()}
            glass={false}
          />
        }
        contentPadding={theme.spacing['3']}>
        {contentPaddingStyle => (
          <View style={[styles.errorContainer, contentPaddingStyle]}>
            <Text style={styles.errorText}>Task not found</Text>
          </View>
        )}
      </LiquidGlassHeaderScreen>
    );
  }

  if (definitionLoading && totalSteps === 0) {
    return (
      <LiquidGlassHeaderScreen
        header={
          <Header
            title={displayDefinition.name}
            showBackButton
            onBack={() => navigation.goBack()}
            glass={false}
          />
        }
        contentPadding={theme.spacing['3']}>
        {contentPaddingStyle => (
          <View style={[styles.errorContainer, contentPaddingStyle]}>
            <Text style={styles.errorText}>Loading observational tool...</Text>
          </View>
        )}
      </LiquidGlassHeaderScreen>
    );
  }

  if (!currentStep || totalSteps === 0) {
    return (
      <LiquidGlassHeaderScreen
        header={
          <Header
            title={displayDefinition.name}
            showBackButton
            onBack={() => navigation.goBack()}
            glass={false}
          />
        }
        contentPadding={theme.spacing['3']}>
        {contentPaddingStyle => (
          <View style={[styles.errorContainer, contentPaddingStyle]}>
            <Text style={styles.errorText}>Unable to load observational tool.</Text>
          </View>
        )}
      </LiquidGlassHeaderScreen>
    );
  }

  const renderImageOptions = () =>
    currentStep.options.map((option: ObservationalToolOption) => {
      const selected = selectionsForStep.includes(option.id);
      return (
        <Pressable
          key={option.id}
          onPress={() => toggleOption(currentStep.id, option.id)}
          style={[
            styles.optionImageCard,
            selected && styles.optionImageCardSelected,
          ]}>
          {option.image ? (
            <Image source={option.image} style={styles.optionImageLarge} />
          ) : null}
          <View style={styles.optionTextBlock}>
            <Text
              style={[
                styles.optionTitle,
                selected && styles.optionTitleSelected,
              ]}>
              {option.title}
            </Text>
            {option.subtitle ? (
              <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
            ) : null}
          </View>
        </Pressable>
      );
    });

  const renderTextOptions = () =>
    currentStep.options.map((option: ObservationalToolOption, index: number) => {
      const selected = selectionsForStep.includes(option.id);
      const showDivider = index < currentStep.options.length - 1;
      return (
        <View key={option.id}>
          <Pressable
            onPress={() => toggleOption(currentStep.id, option.id)}
            style={[styles.optionRadioRow]}>
            <Text
              style={[
                styles.optionRadioLabel,
                selected && styles.optionRadioLabelSelected,
              ]}>
              {option.title}
            </Text>
            <View
              style={[
                styles.radioOuter,
                selected && styles.radioOuterSelected,
              ]}>
              {selected ? <View style={styles.radioInner} /> : null}
            </View>
          </Pressable>
          {showDivider ? <View style={styles.optionDivider} /> : null}
        </View>
      );
    });

  const renderOptions = () =>
    isImageOptionLayout ? renderImageOptions() : renderTextOptions();

  const renderFormActions = () => {
    const isLastStep = effectiveStepIndex === totalSteps - 1;
    if (isLastStep) {
      return (
        <View style={[styles.stepActions, styles.stepActionsStacked]}>
          <LiquidGlassButton
            title="Submit and schedule appointment"
            onPress={handleSubmit}
            height={56}
            borderRadius={16}
            tintColor={theme.colors.secondary}
            shadowIntensity="medium"
            disabled={!isStepCompleted}
            textStyle={styles.confirmPrimaryButtonText}
            style={styles.stepActionButtonFull}
          />
          <LiquidGlassButton
            title="Back"
            onPress={handleStepBack}
            height={56}
            borderRadius={16}
            glassEffect="clear"
            interactive
            forceBorder
            tintColor={theme.colors.surface}
            borderColor={theme.colors.secondary}
            textStyle={styles.backButtonText}
            style={styles.stepActionButtonFull}
          />
        </View>
      );
    }

    return (
      <View style={[styles.stepActions, styles.stepActionsRow]}>
        <LiquidGlassButton
          title="Back"
          onPress={handleStepBack}
          height={56}
          borderRadius={16}
          glassEffect="clear"
          interactive
          forceBorder
          borderColor={theme.colors.secondary}
          textStyle={styles.backButtonText}
          style={styles.stepActionButtonRow}
        />
        <LiquidGlassButton
          title="Next"
          onPress={goToNextStep}
          height={56}
          borderRadius={16}
          tintColor={theme.colors.secondary}
          textStyle={styles.nextText}
          shadowIntensity="medium"
          disabled={!isStepCompleted}
          style={styles.stepActionButtonRow}
        />
      </View>
    );
  };

  const renderFormStage = () => {
    const showValidationMessage = stepTouched && !isStepCompleted;
    return (
      <>
        <Text style={styles.stepMeta}>
          Step {effectiveStepIndex + 1} of {totalSteps}
        </Text>
        <LiquidGlassCard
          glassEffect="regular"
          interactive
          style={[styles.glassCard, styles.stepInfoCard]}
          fallbackStyle={styles.glassCardFallback}>
          <View style={styles.stepHeroWrapper}>
            {companionImageSource ? (
              <Image
                source={companionImageSource}
                style={styles.stepHero}
                onError={() => setCompanionImageError(true)}
              />
            ) : (
              <View style={styles.stepHeroFallback}>
                <Text style={styles.stepHeroFallbackText}>{companionInitial}</Text>
              </View>
            )}
          </View>
          <Text style={styles.stepHeading}>{currentStep.title}</Text>
          <Text style={styles.stepSubtitle}>{currentStep.subtitle}</Text>
        </LiquidGlassCard>
        <LiquidGlassCard
          glassEffect="regular"
          interactive
          style={[styles.glassCard, styles.stepOptionsCard]}
          fallbackStyle={styles.glassCardFallback}>
          <View style={styles.optionsContainer}>{renderOptions()}</View>
          {showValidationMessage ? (
            <Text style={styles.validationText}>Please select an option to continue.</Text>
          ) : null}
          {currentStep.footerNote ? (
            <Text style={styles.stepFooterNote}>{currentStep.footerNote}</Text>
          ) : null}
        </LiquidGlassCard>
        {renderFormActions()}
      </>
    );
  };

  const renderProvidersCard = () => (
    <>
      <LiquidGlassCard
        glassEffect="regular"
        interactive
        style={[styles.glassCard, styles.providersCard]}
        fallbackStyle={styles.glassCardFallback}>
        <View style={styles.providerList}>
          {providerEntries.map(entry => {
            const selected = selectedProviderId === entry.businessId;
            const isLocalAsset = typeof entry.image === 'number';
            const primaryUri =
              typeof entry.image === 'string'
                ? entry.image
                : entry.image?.uri ?? null;
            const shouldUseFallback =
              !isLocalAsset && (!primaryUri || isDummyPhoto(primaryUri));
            const imageSource = resolveImageSource(
              shouldUseFallback ? entry.fallbackImage ?? entry.image : entry.image,
            );
            return (
              <LiquidGlassCard
                key={entry.businessId}
                glassEffect="regular"
                interactive
                padding="0"
                style={[
                  styles.providerCard,
                  selected && styles.providerCardSelected,
                ]}
                fallbackStyle={[
                  styles.providerCard,
                  selected && styles.providerCardSelected,
                ]}>
                <Pressable
                  onPress={() => toggleProvider(entry.businessId)}
                  style={styles.providerInner}>
                  {imageSource ? (
                    <Image
                      source={imageSource}
                      style={styles.providerImage}
                      onError={() =>
                        handleAvatarError(entry.googlePlacesId ?? null, entry.businessId)
                      }
                    />
                  ) : (
                    <View style={styles.providerImageFallback}>
                      <Text style={styles.providerImageFallbackText}>
                        {entry.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.providerContent}>
                    <View style={styles.providerTitleRow}>
                      <Text style={styles.providerName}>{entry.name}</Text>
                      <Text style={styles.serviceBadge}>{entry.serviceName}</Text>
                    </View>
                    {entry.subtitle ? (
                      <Text style={styles.providerSubtitle}>{entry.subtitle}</Text>
                    ) : null}
                    {entry.description ? (
                      <Text style={styles.providerDescription}>{entry.description}</Text>
                    ) : null}
                    {entry.appointmentFee === null || entry.appointmentFee === undefined ? (
                      <Text style={styles.costLabel}>Appointment fee shared during booking</Text>
                    ) : (
                      <View style={styles.providerCosts}>
                        <View style={styles.costColumn}>
                          <Text style={styles.costLabel}>Appointment Fee</Text>
                          <Text style={styles.costValue}>
                            ${entry.appointmentFee.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                </Pressable>
              </LiquidGlassCard>
            );
          })}
        </View>
      </LiquidGlassCard>
      {providerTouched && !selectedProviderId ? (
        <Text style={styles.validationText}>Please select a provider</Text>
      ) : null}
    </>
  );

  const renderProvidersEmptyState = () => (
    <LiquidGlassCard
      glassEffect="regular"
      interactive
      style={[styles.glassCard, styles.emptyStateCard]}
      fallbackStyle={styles.glassCardFallback}>
      <Image source={displayDefinition.emptyState.image || Images.otNoProviders} style={styles.emptyStateImage} />
      <Text style={styles.emptyStateTitle}>{displayDefinition.emptyState.title}</Text>
      <Text style={styles.emptyStateMessage}>{displayDefinition.emptyState.message}</Text>
    </LiquidGlassCard>
  );

  const renderProvidersSection = () =>
    providerEntries.length > 0 ? renderProvidersCard() : renderProvidersEmptyState();

  const renderLandingStage = () => (
    <>
      <LiquidGlassCard
        glassEffect="regular"
        interactive
        style={[styles.glassCard, styles.introCard]}
        fallbackStyle={styles.glassCardFallback}>
        <View style={styles.introImageWrapper}>
          {companionImageSource ? (
            <Image
              source={companionImageSource}
              style={styles.introImage}
              onError={() => setCompanionImageError(true)}
            />
          ) : (
            <View style={styles.initialFallback}>
              <Text style={styles.initialFallbackText}>{companionInitial}</Text>
            </View>
          )}
        </View>
        <Text style={styles.introTitle}>{displayDefinition.overviewTitle}</Text>
        <View style={styles.introParagraphs}>
          {displayDefinition.overviewParagraphs.map((paragraph: string) => (
            <Text key={paragraph} style={styles.introParagraph}>
              {paragraph}
            </Text>
          ))}
        </View>
      </LiquidGlassCard>

      <View style={styles.providersHeader}>
        <Text style={styles.providersTitle}>Evaluation offered by</Text>
      </View>

      {renderProvidersSection()}

      <View style={styles.actions}>
        <LiquidGlassButton
          title="Next"
          onPress={startAssessment}
          height={56}
          borderRadius={16}
          tintColor={theme.colors.secondary}
          textStyle={styles.nextText}
          shadowIntensity="medium"
          disabled={providerEntries.length === 0}
        />
      </View>
    </>
  );

  const renderStage = () =>
    stage === 'form' ? renderFormStage() : renderLandingStage();

  return (
    <>
      <LiquidGlassHeaderScreen
        header={
          <Header
            title={displayDefinition.name}
            showBackButton
            onBack={handleHeaderBack}
            glass={false}
          />
        }
        contentPadding={theme.spacing['3']}
        showBottomFade={false}>
        {contentPaddingStyle => (
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={[styles.container, contentPaddingStyle]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {renderStage()}
          </ScrollView>
        )}
      </LiquidGlassHeaderScreen>

      <DiscardChangesBottomSheet
        ref={discardSheetRef}
        onDiscard={handleDiscardChanges}
        onKeepEditing={() => discardSheetRef.current?.close()}
      />
    </>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    scrollView: {
      flex: 1,
    },
    container: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing['4'],
      paddingBottom: theme.spacing['20'],
      gap: theme.spacing['3'],
      backgroundColor: theme.colors.background,
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing['4'],
    },
    errorText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.error,
    },
    introCard: {
      gap: theme.spacing['3'],
      alignItems: 'center',
      // Spacing handled by container gap
    },
    glassCard: {
      gap: theme.spacing['4'],
      // Spacing handled by container gap
    },
    glassCardFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    introImageWrapper: {
      width: theme.spacing['24'],
      height: theme.spacing['24'],
      borderRadius: theme.borderRadius.full,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.lightBlueBackground,
    },
    introImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    initialFallback: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.lightBlueBackground,
    },
    initialFallbackText: {
      ...theme.typography.h3,
      color: theme.colors.secondary,
    },
    introTitle: {
      ...theme.typography.paragraph18Bold,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    introParagraphs: {
      gap: theme.spacing['2'],
    },
    introParagraph: {
      ...theme.typography.subtitleRegular14,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    providersHeader: {
      gap: theme.spacing['2'],
      alignItems: 'flex-start',
    },
    providersTitle: {
      ...theme.typography.businessSectionTitle20,
      color: theme.colors.black,
      textAlign: 'left',
    },
    nextText:{
      color: theme.colors.white,
    },
    confirmPrimaryButtonText: {
      ...theme.typography.button,
      color: theme.colors.white,
      textAlign: 'center',
    },
    providersCard: {
      gap: theme.spacing['3'],
      // Spacing handled by container gap
    },
    providerList: {
      gap: theme.spacing['3'],
    },
    providerCard: {
      borderRadius: theme.borderRadius.xl,
      borderWidth: 0,
      borderColor: 'transparent',
      backgroundColor: theme.colors.cardBackground,
      overflow: 'hidden',
    },
    providerInner: {
      overflow: 'hidden',
      borderRadius: theme.borderRadius.xl,
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    providerCardSelected: {
      borderColor: theme.colors.primary,
      borderWidth: 1.5,
      ...theme.shadows.medium,
    },
    providerImage: {
      width: theme.spacing['32'],
      height: '100%',
      resizeMode: 'cover',
      borderRadius: theme.borderRadius.lg,
    },
    providerImageFallback: {
      width: theme.spacing['32'],
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.lightBlueBackground,
      borderRadius: theme.borderRadius.lg,
    },
    providerImageFallbackText: {
      ...theme.typography.h3,
      color: theme.colors.secondary,
      fontWeight: '600',
    },
    providerContent: {
      padding: theme.spacing['4'],
      gap: theme.spacing['2'],
      flex: 1,
    },
    providerName: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
    },
    providerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['2'],
      flexWrap: 'wrap',
    },
    serviceBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing['2.5'],
      paddingVertical: theme.spacing['1'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primaryTint,
      ...theme.typography.labelXxsBold,
      color: theme.colors.primary,
    },
    providerSubtitle: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
    },
    providerDescription: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
    },
    providerCosts: {
      flexDirection: 'row',
      gap: theme.spacing['6'],
    },
    costColumn: {
      gap: theme.spacing['1'],
    },
    costLabel: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
    },
    costValue: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
    },
    validationText: {
      ...theme.typography.captionBoldSatoshi,
      color: theme.colors.error,
    },
    emptyStateCard: {
      alignItems: 'center',
      gap: theme.spacing['3'],
      // Spacing handled by container gap
    },
    emptyStateImage: {
      width: theme.spacing['50'],
      height: theme.spacing['60'],
      resizeMode: 'contain',
    },
    emptyStateTitle: {
      ...theme.typography.businessSectionTitle20,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    emptyStateMessage: {
      ...theme.typography.subtitleRegular14,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    actions: {
      marginTop: theme.spacing['2'],
    },
    stepMeta: {
      ...theme.typography.captionBoldSatoshi,
      color: theme.colors.placeholder,
      textAlign: 'center',
      marginTop: theme.spacing['2'],
    },
    stepInfoCard: {
      gap: theme.spacing['3'],
      alignItems: 'center',
      // Spacing handled by container gap
    },
    stepHeroWrapper: {
      alignSelf: 'center',
      width: theme.spacing['20'],
      height: theme.spacing['20'],
      borderRadius: theme.borderRadius.full,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.lightBlueBackground,
    },
    stepHero: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    stepHeroFallback: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.lightBlueBackground,
    },
    stepHeroFallbackText: {
      ...theme.typography.h3,
      color: theme.colors.secondary,
    },
    stepHeading: {
      ...theme.typography.h6Clash,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    stepSubtitle: {
      ...theme.typography.subtitleRegular14,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    stepOptionsCard: {
      gap: theme.spacing['3'],
      // Spacing handled by container gap
    },
    optionsContainer: {
      gap: theme.spacing['2'],
    },
    optionImageCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
      padding: theme.spacing['3'],
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      overflow: 'hidden',
      backgroundColor: theme.colors.cardBackground,
    },
    optionImageCardSelected: {
      borderColor: theme.colors.primary,
      ...theme.shadows.medium,
    },
    optionImageLarge: {
      width: theme.spacing['25'],
      height: theme.spacing['25'],
      resizeMode: 'cover',
    },
    optionTextBlock: {
      flex: 1,
      gap: theme.spacing['1'],
    },
    optionRadioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing['3'],
      paddingHorizontal: theme.spacing['2'],
      borderRadius: theme.borderRadius.md,
    },
    optionRadioLabel: {
      ...theme.typography.paragraphBold,
      color: theme.colors.secondary,
      flex: 1,
      marginRight: theme.spacing['3'],
    },
    optionRadioLabelSelected: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    optionDivider: {
      height: 1,
      backgroundColor: theme.colors.borderMuted,
      marginHorizontal: theme.spacing['1'],
    },
    radioOuter: {
      width: theme.spacing['6'],
      height: theme.spacing['6'],
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOuterSelected: {
      borderColor: theme.colors.primary,
    },
    radioInner: {
      width: theme.spacing['2.5'],
      height: theme.spacing['2.5'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primary,
    },
    optionTitle: {
      ...theme.typography.paragraphBold,
      color: theme.colors.secondary,
    },
    optionTitleSelected: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    optionSubtitle: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
    },
    stepFooterNote: {
      ...theme.typography.body13,
      color: theme.colors.placeholder,
      textAlign: 'center',
    },
    stepActions: {
      alignSelf: 'stretch',
      gap: theme.spacing['3'],
    },
    stepActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing['3'],
    },
    stepActionsStacked: {
      flexDirection: 'column',
      alignItems: 'stretch',
    },
    stepActionButtonRow: {
      flex: 1,
    },
    stepActionButtonFull: {
      width: '100%',
    },
    backButtonText: {
      ...theme.typography.button,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
  });

export default ObservationalToolScreen;
