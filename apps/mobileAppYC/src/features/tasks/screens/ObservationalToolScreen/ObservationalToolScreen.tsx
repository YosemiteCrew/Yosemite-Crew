import React, {useMemo, useState, useEffect, useCallback, useRef} from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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

import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '@/hooks';
import {fonts} from '@/theme/typography';
import type {RootState, AppDispatch} from '@/app/store';
import type {TaskStackParamList, TabParamList} from '@/navigation/types';
import {
  observationalToolDefinitions,
  observationalToolProviders,
} from '@/features/observationalTools/data';
import type {
  ObservationalToolDefinition,
  ObservationalToolProviderPricing,
  ObservationalToolBookingContext,
  ObservationalToolResponses,
} from '@/features/observationalTools/types';
import {selectTaskById} from '@/features/tasks/selectors';
import type {ObservationalToolTaskDetails} from '@/features/tasks/types';
import {fetchBusinesses} from '@/features/appointments/businessesSlice';
import {resolveObservationalToolLabel} from '@/features/tasks/utils/taskLabels';
import {markTaskStatus} from '@/features/tasks/thunks';
import {setSelectedCompanion} from '@/features/companion';
import type {VetBusiness} from '@/features/appointments/types';
import {
  DiscardChangesBottomSheet,
  DiscardChangesBottomSheetRef,
} from '@/shared/components/common/DiscardChangesBottomSheet/DiscardChangesBottomSheet';

type Navigation = NativeStackNavigationProp<TaskStackParamList, 'ObservationalTool'>;
type Route = RouteProp<TaskStackParamList, 'ObservationalTool'>;

interface ProviderEntry {
  businessId: string;
  pricing: ObservationalToolProviderPricing;
  name: string;
  subtitle?: string;
  description?: string;
  image?: any;
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
  const companion = useSelector((state: RootState) =>
    task ? state.companion.companions.find(c => c.id === task.companionId) : null,
  );
  const businesses = useSelector((state: RootState) => state.businesses.businesses);

  useEffect(() => {
    if (!businesses.length) {
      dispatch(fetchBusinesses());
    }
  }, [dispatch, businesses.length]);

  const [stage, setStage] = useState<'landing' | 'form'>('landing');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [responses, setResponses] = useState<ObservationalToolResponses>({});
  const [showProviders, setShowProviders] = useState(true);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [providerTouched, setProviderTouched] = useState(false);
  const [stepTouched, setStepTouched] = useState(false);
  const scrollToTop = useCallback(() => {
    scrollViewRef.current?.scrollTo({y: 0, animated: true});
  }, []);

  const details = task?.details
    ? (task.details as ObservationalToolTaskDetails)
    : null;

  const toolType = details?.toolType ?? null;

  const definition: ObservationalToolDefinition | null = useMemo(() => {
    if (!toolType) {
      return null;
    }
    return observationalToolDefinitions[toolType];
  }, [toolType]);

  const providerPricing = useMemo(() => {
    if (!toolType) {
      return [];
    }
    return observationalToolProviders[toolType] ?? [];
  }, [toolType]);

  const hospitalBusinesses = useMemo(
    () => businesses.filter(business => business.category === 'hospital'),
    [businesses],
  );

  const resolveBusinessDescription = useCallback((biz: VetBusiness) => {
    if (biz.description && biz.description.trim().length > 0) {
      return biz.description.trim();
    }
    if (biz.specialties && biz.specialties.length > 0) {
      return biz.specialties.slice(0, 3).join(', ');
    }
    if (biz.openHours && biz.openHours.trim().length > 0) {
      return `${biz.name} · ${biz.openHours}`;
    }
    return `Located at ${biz.address}`;
  }, []);

  const toolLabel = toolType
    ? resolveObservationalToolLabel(toolType)
    : 'Observational tool';

  const providerEntries: ProviderEntry[] = useMemo(() => {
    if (!showProviders) {
      return [];
    }

    if (hospitalBusinesses.length > 0) {
      return hospitalBusinesses.map((biz, index) => {
        let matchedPricing =
          providerPricing.find(p => p.businessId === biz.id) ?? null;

        if (!matchedPricing) {
          const fallbackByIndex = providerPricing[index];
          if (fallbackByIndex) {
            matchedPricing = {...fallbackByIndex, businessId: biz.id};
          } else if (providerPricing[0]) {
            matchedPricing = {...providerPricing[0], businessId: biz.id};
          } else {
            matchedPricing = {
              businessId: biz.id,
              evaluationFee: 0,
              appointmentFee: 0,
            };
          }
        }

        return {
          businessId: biz.id,
          pricing: matchedPricing,
          name: biz.name,
          subtitle: biz.openHours ?? biz.address,
          description: resolveBusinessDescription(biz),
          image: biz.photo,
        };
      });
    }

    return providerPricing.slice(0, 3).map((pricing, index) => {
      const biz = businesses.find(b => b.id === pricing.businessId);
      return {
        businessId: pricing.businessId,
        pricing,
        name: biz?.name ?? `Partner clinic ${index + 1}`,
        subtitle: biz?.address ?? 'Location coming soon',
        description:
          biz?.description ??
          'We are lining up trusted specialists for this evaluation.',
        image: biz?.photo,
      };
    });
  }, [
    businesses,
    hospitalBusinesses,
    providerPricing,
    resolveBusinessDescription,
    showProviders,
  ]);

  useEffect(() => {
    if (!showProviders) {
      setSelectedProviderId(null);
      setProviderTouched(false);
    }
  }, [showProviders]);


  const totalSteps = definition?.steps.length ?? 0;
  const effectiveStepIndex =
    totalSteps > 0 ? Math.min(currentStepIndex, totalSteps - 1) : 0;
  const currentStep =
    definition && totalSteps > 0 ? definition.steps[effectiveStepIndex] : null;
  const selectionsForStep = currentStep
    ? responses[currentStep.id] ?? []
    : [];
  const isStepCompleted = selectionsForStep.length > 0;
  const isImageOptionLayout = (definition?.species ?? 'dog') !== 'dog';

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

  const companionImageSource = useMemo(
    () => (companion?.profileImage ? {uri: companion.profileImage} : null),
    [companion?.profileImage],
  );

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
    if (showProviders && providerEntries.length > 0 && !selectedProviderId) {
      setProviderTouched(true);
      return;
    }
    setStage('form');
  };

  // moved above to avoid use-before-declare in callbacks

  const resolvedProvider = useMemo<ObservationalToolProviderPricing | null>(() => {
    if (showProviders && providerEntries.length === 0) {
      return null;
    }

    const selectedEntry = selectedProviderId
      ? providerEntries.find(entry => entry.businessId === selectedProviderId)
      : providerEntries[0];

    const provider =
      selectedEntry?.pricing ??
      providerPricing.find(p => p.businessId === selectedProviderId) ??
      providerEntries[0]?.pricing ??
      providerPricing[0];

    return provider ?? null;
  }, [providerEntries, providerPricing, selectedProviderId, showProviders]);

  const handleSubmit = useCallback(async () => {
    if (!task || !details || !definition) {
      return;
    }

    if (showProviders && providerEntries.length > 0 && !selectedProviderId) {
      setProviderTouched(true);
      return;
    }

    if (!resolvedProvider) {
      setProviderTouched(true);
      return;
    }

    const responsesSnapshot = definition.steps.reduce<ObservationalToolResponses>(
      (acc, step) => {
        acc[step.id] = [...(responses[step.id] ?? [])];
        return acc;
      },
      {},
    );

    await dispatch(markTaskStatus({taskId: task.id, status: 'completed'}));
    if (companion) {
      dispatch(setSelectedCompanion(companion.id));
    }

    const appointmentType = `Observational Tool - ${definition.name}`;
    const otContext: ObservationalToolBookingContext = {
      toolId: details.toolType,
      provider: resolvedProvider,
      responses: responsesSnapshot,
    };

    tabNavigation?.navigate('Appointments', {
      screen: 'BookingForm',
      params: {
        businessId: resolvedProvider.businessId,
        employeeId: resolvedProvider.employeeId ?? providerPricing[0]?.employeeId,
        appointmentType,
        otContext,
      },
    } as any);
  }, [
    companion,
    definition,
    details,
    dispatch,
    providerPricing,
    providerEntries,
    resolvedProvider,
    responses,
    selectedProviderId,
    showProviders,
    tabNavigation,
    task,
  ]);

  if (!task || !details || !definition || !currentStep || totalSteps === 0) {
    return (
      <SafeArea>
        <Header
          title="Observational Tool"
          showBackButton
          onBack={() => navigation.goBack()}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Task not found</Text>
        </View>
      </SafeArea>
    );
  }

  const renderImageOptions = () =>
    currentStep.options.map(option => {
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
    currentStep.options.map((option, index) => {
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
              <Image source={companionImageSource} style={styles.stepHero} />
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
            return (
              <Pressable
                key={entry.businessId}
                onPress={() => toggleProvider(entry.businessId)}
                style={[
                  styles.providerCard,
                  selected && styles.providerCardSelected,
                ]}>
                {entry.image ? (
                  <Image source={entry.image} style={styles.providerImage} />
                ) : (
                  <View style={styles.providerImageFallback}>
                    <Text style={styles.providerImageFallbackText}>
                      {entry.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.providerContent}>
                  <Text style={styles.providerName}>{entry.name}</Text>
                  {entry.subtitle ? (
                    <Text style={styles.providerSubtitle}>{entry.subtitle}</Text>
                  ) : null}
                  {entry.description ? (
                    <Text style={styles.providerDescription}>{entry.description}</Text>
                  ) : null}
                  <View style={styles.providerCosts}>
                    <View style={styles.costColumn}>
                      <Text style={styles.costLabel}>Evaluation Fee</Text>
                      <Text style={styles.costValue}>
                        ${entry.pricing.evaluationFee.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.costColumn}>
                      <Text style={styles.costLabel}>Appointment Fee</Text>
                      <Text style={styles.costValue}>
                        ${entry.pricing.appointmentFee.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </LiquidGlassCard>
      {providerTouched && !selectedProviderId ? (
        <Text style={styles.validationText}>Please select evaluation provider</Text>
      ) : null}
    </>
  );

  const renderProvidersEmptyState = () => (
    <LiquidGlassCard
      glassEffect="regular"
      interactive
      style={[styles.glassCard, styles.emptyStateCard]}
      fallbackStyle={styles.glassCardFallback}>
      <Image source={definition.emptyState.image} style={styles.emptyStateImage} />
      <Text style={styles.emptyStateTitle}>{definition.emptyState.title}</Text>
      <Text style={styles.emptyStateMessage}>{definition.emptyState.message}</Text>
    </LiquidGlassCard>
  );

  const renderProvidersSection = () =>
    showProviders ? renderProvidersCard() : renderProvidersEmptyState();

  const renderLandingStage = () => (
    <>
      <LiquidGlassCard
        glassEffect="regular"
        interactive
        style={[styles.glassCard, styles.introCard]}
        fallbackStyle={styles.glassCardFallback}>
        <View style={styles.introImageWrapper}>
          {companionImageSource ? (
            <Image source={companionImageSource} style={styles.introImage} />
          ) : (
            <View style={styles.initialFallback}>
              <Text style={styles.initialFallbackText}>{companionInitial}</Text>
            </View>
          )}
        </View>
        <Text style={styles.introTitle}>{definition.overviewTitle}</Text>
        <View style={styles.introParagraphs}>
          {definition.overviewParagraphs.map(paragraph => (
            <Text key={paragraph} style={styles.introParagraph}>
              {paragraph}
            </Text>
          ))}
        </View>
      </LiquidGlassCard>

      <View style={styles.providersHeader}>
        <Text style={styles.providersTitle}>Evaluation offered by</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>
            {showProviders ? 'Hide mock providers' : 'Show mock providers'}
          </Text>
          <Switch
            value={showProviders}
            onValueChange={value => setShowProviders(value)}
            trackColor={{
              false: theme.colors.borderMuted,
              true: theme.colors.primary,
            }}
            thumbColor={theme.colors.white}
          />
        </View>
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
          disabled={showProviders && providerEntries.length === 0}
        />
      </View>
    </>
  );

  const renderStage = () =>
    stage === 'form' ? renderFormStage() : renderLandingStage();

  return (
    <SafeArea>
      <Header
        title={definition.name}
        showBackButton
        onBack={handleHeaderBack}
      />
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}>
        {renderStage()}
      </ScrollView>
      <DiscardChangesBottomSheet
        ref={discardSheetRef}
        onDiscard={handleDiscardChanges}
        onKeepEditing={() => discardSheetRef.current?.close()}
      />
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      padding: theme.spacing[4],
      paddingBottom: theme.spacing[20],
      gap: theme.spacing[4],
      backgroundColor: theme.colors.background,
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing[4],
    },
    errorText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.error,
    },
    introCard: {
      gap: theme.spacing[3],
      alignItems: 'center',
    },
    glassCard: {
      gap: theme.spacing[4],
    },
    glassCardFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    introImageWrapper: {
      width: 96,
      height: 96,
      borderRadius: 48,
      overflow: 'hidden',
      borderWidth: 2,
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
      fontFamily: theme.typography.paragraph18Bold.fontFamily,
      fontSize: 18,
      fontWeight: '700',
      lineHeight: 18 * 1.4,
      letterSpacing: -0.36,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    introParagraphs: {
      gap: theme.spacing[2],
    },
    introParagraph: {
      fontFamily: theme.typography.subtitleRegular14.fontFamily,
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 14 * 1.2,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    providersHeader: {
      gap: theme.spacing[2],
      alignItems: 'flex-start',
    },
    providersTitle: {
      fontFamily: theme.typography.businessSectionTitle20.fontFamily,
      fontSize: 20,
      fontWeight: '500',
      lineHeight: 24,
      letterSpacing: -0.2,
      color: '#000',
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
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing[2],
    },
    toggleLabel: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
      flex: 1,
    },
    providersCard: {
      gap: theme.spacing[3],
    },
    providerList: {
      gap: theme.spacing[3],
    },
    providerCard: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
      overflow: 'hidden',
    },
    providerCardSelected: {
      borderColor: theme.colors.primary,
      borderWidth: 2,
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.2,
      shadowOffset: {width: 0, height: 6},
      shadowRadius: 12,
    },
    providerImage: {
      width: '100%',
      height: 140,
      resizeMode: 'cover',
    },
    providerImageFallback: {
      height: 140,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.lightBlueBackground,
    },
    providerImageFallbackText: {
      ...theme.typography.h3,
      color: theme.colors.secondary,
      fontWeight: '600',
    },
    providerContent: {
      padding: theme.spacing[4],
      gap: theme.spacing[2],
    },
    providerName: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
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
      gap: theme.spacing[6],
    },
    costColumn: {
      gap: theme.spacing[1],
    },
    costLabel: {
      ...theme.typography.labelXsBold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
    },
    costValue: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
    },
    validationText: {
      fontFamily: theme.typography.captionBoldSatoshi.fontFamily,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 13 * 1.2,
      color: '#EA3729',
    },
    emptyStateCard: {
      alignItems: 'center',
      gap: theme.spacing[3],
    },
    emptyStateImage: {
      width: 200,
      height: 243,
      resizeMode: 'contain',
    },
    emptyStateTitle: {
      fontFamily: theme.typography.businessSectionTitle20.fontFamily,
      fontSize: 20,
      fontWeight: '500',
      lineHeight: 24,
      letterSpacing: -0.2,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    emptyStateMessage: {
      fontFamily: theme.typography.subtitleRegular14.fontFamily,
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 14 * 1.2,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    actions: {
      marginTop: theme.spacing[2],
    },
    stepMeta: {
      fontFamily: fonts.SATOSHI_BOLD,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 13 * 1.2,
      color: theme.colors.placeholder,
      textAlign: 'center',
      marginTop: theme.spacing[2],
    },
    stepInfoCard: {
      gap: theme.spacing[3],
      alignItems: 'center',
    },
    stepHeroWrapper: {
      alignSelf: 'center',
      width: 88,
      height: 88,
      borderRadius: 44,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: theme.colors.primary,
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
      fontFamily: theme.typography.h6Clash.fontFamily,
      fontSize: 18,
      fontWeight: '500',
      lineHeight: 18 * 1.2,
      letterSpacing: -0.18,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    stepSubtitle: {
      fontFamily: theme.typography.subtitleRegular14.fontFamily,
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 14 * 1.2,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    stepOptionsCard: {
      gap: theme.spacing[3],
    },
    optionsContainer: {
      gap: theme.spacing[2],
    },
    optionImageCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
      padding: theme.spacing[3],
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      overflow: 'hidden',
      backgroundColor: theme.colors.cardBackground,
    },
    optionImageCardSelected: {
      borderColor: theme.colors.primary,
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.18,
      shadowOffset: {width: 0, height: 6},
      shadowRadius: 10,
    },
    optionImageLarge: {
      width: 100,
      height: 100,
      resizeMode: 'cover',
    },
    optionTextBlock: {
      flex: 1,
      gap: theme.spacing[1],
    },
    optionRadioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing[3],
      paddingHorizontal: theme.spacing[2],
      borderRadius: theme.borderRadius.md,
    },
    optionRadioLabel: {
      fontFamily: theme.typography.paragraphBold.fontFamily,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 16 * 1.2,
      letterSpacing: -0.32,
      color: theme.colors.secondary,
      flex: 1,
      marginRight: theme.spacing[3],
    },
    optionRadioLabelSelected: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    optionDivider: {
      height: 1,
      backgroundColor: theme.colors.borderMuted,
      marginHorizontal: theme.spacing[1],
    },
    radioOuter: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: theme.colors.borderMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOuterSelected: {
      borderColor: theme.colors.primary,
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.primary,
    },
    optionTitle: {
      fontFamily: theme.typography.paragraphBold.fontFamily,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 16 * 1.2,
      letterSpacing: -0.32,
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
      fontFamily: fonts.SATOSHI_REGULAR,
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 13 * 1.2,
      color: theme.colors.placeholder,
      textAlign: 'center',
    },
    stepActions: {
      alignSelf: 'stretch',
      gap: theme.spacing[3],
    },
    stepActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing[3],
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
