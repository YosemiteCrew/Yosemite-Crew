import React, {useEffect, useMemo, useState} from 'react';
import {ScrollView, View, Text, StyleSheet, TextInput, Image, Keyboard} from 'react-native';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import RatingStars from '@/shared/components/common/RatingStars/RatingStars';
import {SummaryCards} from '@/features/appointments/components/SummaryCards/SummaryCards';
import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch, RootState} from '@/app/store';
import {appointmentApi} from '@/features/appointments/services/appointmentsService';
import {getFreshStoredTokens, isTokenExpired} from '@/features/auth/sessionManager';
import {fetchBusinessDetails, fetchGooglePlacesImage} from '@/features/linkedBusinesses';
import {fetchBusinesses} from '@/features/appointments/businessesSlice';
import {Images} from '@/assets/images';
import {isDummyPhoto} from '@/features/appointments/utils/photoUtils';
import {createLiquidGlassHeaderStyles} from '@/shared/utils/screenStyles';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

export const ReviewScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const [topGlassHeight, setTopGlassHeight] = React.useState(0);
  const [review, setReview] = useState('');
  const [rating, setRating] = useState(4);
  const [submitting, setSubmitting] = useState(false);
  const [fallbackPhoto, setFallbackPhoto] = useState<string | null>(null);
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<Nav>();
  const appointmentId = (navigation.getState() as any)?.routes?.slice(-1)[0]?.params?.appointmentId;
  const apt = useSelector((s: RootState) => s.appointments.items.find(a => a.id === appointmentId));
  const business = useSelector((s: RootState) => s.businesses.businesses.find(b => b.id === apt?.businessId));

  useEffect(() => {
    if (!business && apt?.businessId) {
      dispatch(fetchBusinesses(undefined));
    }
  }, [apt?.businessId, business, dispatch]);

  const googlePlacesId = business?.googlePlacesId ?? apt?.businessGooglePlacesId ?? null;
  const businessPhoto = business?.photo ?? apt?.businessPhoto ?? null;

  const displayBusiness = useMemo(
    () => ({
      name: business?.name ?? apt?.organisationName ?? 'Clinic',
      openHours: business?.openHours,
      distanceMi: business?.distanceMi,
      rating: business?.rating,
      address: business?.address ?? apt?.organisationAddress,
      website: business?.website,
      photo: businessPhoto ?? undefined,
    }),
    [apt?.organisationAddress, apt?.organisationName, business, businessPhoto],
  );

  useEffect(() => {
    if (!googlePlacesId) return;
    const isDummy = isDummyPhoto(businessPhoto);
    if (businessPhoto && !isDummy) return;

    dispatch(fetchBusinessDetails(googlePlacesId))
      .unwrap()
      .then(res => {
        if (res.photoUrl) setFallbackPhoto(res.photoUrl);
      })
      .catch(() => {
        dispatch(fetchGooglePlacesImage(googlePlacesId))
          .unwrap()
          .then(img => {
            if (img.photoUrl) setFallbackPhoto(img.photoUrl);
          })
          .catch(() => {});
      });
  }, [businessPhoto, dispatch, googlePlacesId]);

  const handleSubmit = async () => {
    const organisationId = business?.id ?? apt?.businessId;
    if (!organisationId) {
      navigation.goBack();
      return;
    }
    try {
      setSubmitting(true);
      const tokens = await getFreshStoredTokens();
      if (!tokens?.accessToken || isTokenExpired(tokens?.expiresAt ?? undefined)) {
        throw new Error('Session expired. Please sign in again.');
      }
      await appointmentApi.rateOrganisation({
        organisationId,
        rating,
        review,
        accessToken: tokens.accessToken,
      });
      navigation.goBack();
    } catch (error) {
      console.warn('[Review] Failed to submit rating', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeArea edges={[]}>
      <View
        style={styles.topSection}
        onLayout={event => {
          const height = event.nativeEvent.layout.height;
          if (height !== topGlassHeight) {
            setTopGlassHeight(height);
          }
        }}>
        <View style={styles.topGlassShadowWrapper}>
          <LiquidGlassCard
            glassEffect="clear"
            interactive={false}
            shadow="none"
            style={[styles.topGlassCard, {paddingTop: insets.top}]}
            fallbackStyle={styles.topGlassFallback}>
            <Header title="Review" showBackButton onBack={() => navigation.goBack()} glass={false} />
          </LiquidGlassCard>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          topGlassHeight
            ? {paddingTop: topGlassHeight + theme.spacing['3']}
            : null,
        ]}
        showsVerticalScrollIndicator={false}>
        {apt && (
          <View style={styles.businessCardContainer}>
            <SummaryCards
              businessSummary={{
                name: displayBusiness.name,
                address: displayBusiness.address,
                description: undefined,
                photo: displayBusiness.photo ?? fallbackPhoto ?? undefined,
              }}
              cardStyle={styles.summaryCard}
            />
          </View>
        )}

        <View style={styles.headerSection}>
          <View style={styles.checkmarkContainer}>
            <Image source={Images.tickGreen} style={styles.checkmarkIcon} />
          </View>
          <Text style={styles.title}>Consultation Complete</Text>
          <Text style={styles.subtitle}>Share feedback</Text>
        </View>

        {apt && (
          <View style={styles.ratingSection}>
            <RatingStars value={rating} onChange={setRating} size={28} />
          </View>
        )}

        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Review</Text>
          <View style={styles.textArea}>
            <TextInput
              value={review}
              onChangeText={setReview}
              multiline={false}
              placeholder="Your review"
              placeholderTextColor={theme.colors.textSecondary + '80'}
              style={styles.input}
              textAlignVertical="top"
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <LiquidGlassButton
            title="Submit Feedback"
            onPress={handleSubmit}
            height={56}
            borderRadius={16}
            tintColor={theme.colors.secondary}
            shadowIntensity="medium"
            disabled={submitting}
          />
        </View>
      </ScrollView>
    </SafeArea>
  );
};

const createStyles = (theme: any) => {
  const headerStyles = createLiquidGlassHeaderStyles(theme);
  return StyleSheet.create({
    container: {
      padding: theme.spacing['4'],
      paddingBottom: theme.spacing['24'],
    },
    ...headerStyles,
    headerSection: {
    alignItems: 'center',
    marginBottom: theme.spacing['5'],
  },
  checkmarkContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing['6'],
        marginBottom: theme.spacing['12'],
  },
  checkmarkIcon: {
    width: 100,
    height: 100,
  },
  title: {
    ...theme.typography.h3,
    color: theme.colors.secondary,
    marginBottom: theme.spacing['2'],
    textAlign: 'center',
  },
  subtitle: {
    ...theme.typography.body14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  businessCardContainer: {
    marginBottom: theme.spacing['4'],
  },
  summaryCard: {
    marginBottom: theme.spacing['2'],
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: theme.spacing['6'],
  },
  reviewSection: {
    marginBottom: theme.spacing['4'],
  },
  reviewLabel: {
    ...theme.typography.titleMedium,
    color: theme.colors.secondary,
    marginBottom: theme.spacing['3'],
  },
  textArea: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing['3'],
    paddingVertical: theme.spacing['3'],
    minHeight: 140,
    backgroundColor: theme.colors.inputBackground,
  },
  input: {
    ...theme.typography.body14,
    color: theme.colors.text,
    minHeight: 120,
  },
  buttonContainer: {
    marginTop: theme.spacing['2'],
  },
  });
};

export default ReviewScreen;
