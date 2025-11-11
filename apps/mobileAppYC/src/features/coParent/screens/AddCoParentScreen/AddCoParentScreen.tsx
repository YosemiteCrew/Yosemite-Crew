import React, {useState, useCallback, useMemo} from 'react';
import {View, StyleSheet, ScrollView, Image, Text, ActivityIndicator, KeyboardAvoidingView, Platform, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import {useForm, Controller} from 'react-hook-form';
import type {AppDispatch} from '@/app/store';
import {useTheme} from '@/hooks';
import {Header} from '@/shared/components/common/Header/Header';
import {SearchBar} from '@/shared/components/common/SearchBar/SearchBar';
import {Input} from '@/shared/components/common';
import {Images} from '@/assets/images';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {searchCoParentsByEmail, addCoParent} from '../../index';
import {selectAuthUser} from '@/features/auth/selectors';
import type {CoParentStackParamList} from '@/navigation/types';
import type {CoParent} from '../../types';
import AddCoParentBottomSheet from '../../components/AddCoParentBottomSheet/AddCoParentBottomSheet';
import CoParentInviteBottomSheet from '../../components/CoParentInviteBottomSheet/CoParentInviteBottomSheet';
import {useCoParentInviteFlow} from '../../hooks/useCoParentInviteFlow';
import {SearchDropdownOverlay} from '@/shared/components/common/SearchDropdownOverlay/SearchDropdownOverlay';

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
  const authUser = useSelector(selectAuthUser);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CoParent[]>([]);
  const [searching, setSearching] = useState(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
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

  const {
    addCoParentSheetRef,
    coParentInviteSheetRef,
    handleAddCoParentClose,
    handleInviteAccept,
    handleInviteDecline,
  } = useCoParentInviteFlow({
    onInviteComplete: () => navigation.goBack(),
  });

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const result = await dispatch(searchCoParentsByEmail(query)).unwrap();
      setSearchResults(result);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  }, [dispatch]);

  const handleSelectUser = useCallback((user: CoParent) => {
    navigation.navigate('CoParentProfile', {coParentId: user.id});
  }, [navigation]);

  const handleSendInvite = useCallback(async (data: InviteFormData) => {
    try {
      await dispatch(
        addCoParent({
          userId: authUser?.id || '',
          inviteRequest: data,
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
  }, [dispatch, authUser?.id, reset, addCoParentSheetRef]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handleSheetChange = useCallback((index: number) => {
    // index -1 means sheet is closed, >= 0 means sheet is open
    setIsBottomSheetOpen(index >= 0);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Add co-parent" showBackButton onBack={handleBack} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        <View style={styles.mainContent}>
          {/* Search Bar Container - Fixed at top */}
          <View style={styles.searchBarContainer}>
            <SearchBar
              placeholder="Search Co-Parent's email"
              mode="input"
              value={searchQuery}
              onChangeText={handleSearch}
            />
          </View>

          {/* Scrollable Content */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">

            {/* Hero Image - always show */}
            <Image source={Images.heroImage} style={styles.heroImage} />

            {/* Divider - always show */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Send an invite</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Invite Description - always show */}
            <View style={styles.inviteDescriptionContainer}>
              <Text style={styles.inviteDescriptionText}>
                Seems like your friend is not a fan of this app.{'\n'}No worries, Yosemite Crew can send a request on your behalf!
              </Text>
            </View>

            {/* Invite Form - always visible */}
            <View style={styles.formContainer}>
              <View style={styles.formSection}>
                <Controller
                  control={control}
                  name="candidateName"
                  rules={{
                    required: 'Candidate name is required',
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
                      label="Candidate name"
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
                  tintColor={theme.colors.secondary}
                  shadowIntensity="medium"
                  forceBorder
                  borderColor={theme.colors.borderMuted}
                  height={56}
                  borderRadius={16}
                  loading={isSubmitting}
                />
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Search Loading Indicator - Absolutely Positioned Overlay */}
        {searching && !isBottomSheetOpen && (
          <View style={styles.absoluteSearchLoadingContainer}>
            <View style={styles.searchLoadingContainer}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          </View>
        )}

        <SearchDropdownOverlay
          visible={searchQuery.length >= 3 && searchResults.length > 0 && !searching && !isBottomSheetOpen}
          items={searchResults}
          keyExtractor={item => item.id}
          onPress={handleSelectUser}
          title={item => `${item.firstName} ${item.lastName}`}
          subtitle={item => item.email}
          initials={item => item.firstName}
        />
      </KeyboardAvoidingView>

      <AddCoParentBottomSheet
        ref={addCoParentSheetRef}
        coParentEmail={submittedData.email}
        coParentPhone={submittedData.phoneNumber}
        coParentName={submittedData.candidateName}
        onConfirm={handleAddCoParentClose}
        onSheetChange={handleSheetChange}
      />

      <CoParentInviteBottomSheet
        ref={coParentInviteSheetRef}
        coParentName={submittedData.candidateName}
        companionName="Companion"
        onAccept={handleInviteAccept}
        onDecline={handleInviteDecline}
        onSheetChange={handleSheetChange}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    mainContent: {
      flex: 1,
    },
    searchBarContainer: {
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[4],
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing[4],
      paddingBottom: theme.spacing[24],
      paddingTop: theme.spacing[3],
    },
    heroImage: {
      width: '100%',
      height: 220,
      resizeMode: 'contain',
      marginVertical: theme.spacing[4],
    },
    absoluteSearchLoadingContainer: {
      position: 'absolute',
      top: 70,
      left: theme.spacing[4],
      right: theme.spacing[4],
    },
    searchLoadingContainer: {
      paddingVertical: theme.spacing[3],
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.white,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
    },
    dividerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
      marginInline:40
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.text,
    },
    dividerText: {
      ...theme.typography.h4Alt,
      color: theme.colors.text,
    },
    inviteDescriptionContainer: {
      marginVertical: theme.spacing[3],
    },
    inviteDescriptionText: {
      ...theme.typography.inputLabel,
      color: theme.colors.text,
      lineHeight: 20,
      paddingInline: 10,
    },
    formContainer: {
      gap: theme.spacing[4],
    },
    formSection: {
      gap: theme.spacing[4],
    },
    inputContainer: {
      marginBottom: 0,
    },
    saveButton: {
      marginTop: theme.spacing[5],
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
      ...theme.typography.titleMedium,
    },
    centerContent: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.spacing[4],
    },
  });

export default AddCoParentScreen;
