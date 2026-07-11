import React, {useEffect, useMemo, useState} from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TextInput,
  Image,
  Keyboard,
} from 'react-native';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import RatingStars from '@/shared/components/common/RatingStars/RatingStars';
import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch, RootState} from '@/app/store';
import {appointmentApi} from '@/features/appointments/services/appointmentsService';
import {
  getFreshStoredTokens,
  isTokenExpired,
} from '@/features/auth/sessionManager';
import {
  fetchBusinessDetails,
  fetchGooglePlacesImage,
} from '@/features/linkedBusinesses';
import {fetchBusinesses} from '@/features/appointments/businessesSlice';
import {isDummyPhoto} from '@/features/appointments/utils/photoUtils';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

const formatVisitDate = (value?: string | null): string => {
  if (!value) return '';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getDate()} ${parsed.toLocaleString('en-US', {
    month: 'short',
  })}`;
};

export const ReviewScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [review, setReview] = useState('');
  const [rating, setRating] = useState(4);
  const [submitting, setSubmitting] = useState(false);
  const [fallbackPhoto, setFallbackPhoto] = useState<string | null>(null);
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<Nav>();
  const appointmentId = (navigation.getState() as any)?.routes?.slice(-1)[0]
    ?.params?.appointmentId;
  const apt = useSelector((s: RootState) =>
    s.appointments.items.find(a => a.id === appointmentId),
  );
  const business = useSelector((s: RootState) =>
    s.businesses.businesses.find(b => b.id === apt?.businessId),
  );
  const companion = useSelector((s: RootState) =>
    s.companion?.companions?.find(c => c.id === apt?.companionId),
  );

  useEffect(() => {
    if (!business && apt?.businessId) {
      dispatch(fetchBusinesses(undefined));
    }
  }, [apt?.businessId, business, dispatch]);

  const googlePlacesId =
    business?.googlePlacesId ?? apt?.businessGooglePlacesId ?? null;
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
      if (
        !tokens?.accessToken ||
        isTokenExpired(tokens?.expiresAt ?? undefined)
      ) {
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

  const avatarPhoto = displayBusiness.photo ?? fallbackPhoto ?? null;
  const hasAvatarPhoto =
    typeof avatarPhoto === 'string' &&
    avatarPhoto.length > 0 &&
    !isDummyPhoto(avatarPhoto);
  const subjectName = companion?.name ?? null;
  const avatarInitial = (subjectName ?? displayBusiness.name ?? 'C')
    .trim()
    .charAt(0)
    .toUpperCase();
  const visitTitle = subjectName
    ? `How was ${subjectName}'s visit?`
    : 'How was your visit?';
  const metaLine = [apt?.type, apt?.employeeName, formatVisitDate(apt?.date)]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <LiquidGlassHeaderScreen
      header={
        <Header
          title="Review"
          showBackButton
          onBack={() => navigation.goBack()}
          glass={false}
        />
      }
      contentPadding={theme.spacing['3']}
      showBottomFade={false}>
      {contentPaddingStyle => (
        <ScrollView
          contentContainerStyle={[styles.container, contentPaddingStyle]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.avatarTile}>
            {hasAvatarPhoto ? (
              <Image
                source={{uri: avatarPhoto as string}}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.avatarInitial}>{avatarInitial}</Text>
            )}
          </View>

          <Text style={styles.title}>{visitTitle}</Text>
          {metaLine.length > 0 && (
            <Text style={styles.subtitle}>{metaLine}</Text>
          )}

          {apt && (
            <View style={styles.ratingSection}>
              <RatingStars value={rating} onChange={setRating} size={34} />
            </View>
          )}

          <View style={styles.textArea}>
            <TextInput
              value={review}
              onChangeText={setReview}
              multiline={false}
              placeholder="Your review"
              placeholderTextColor={theme.colors.inkFaint}
              style={styles.input}
              textAlignVertical="top"
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
          </View>

          <View style={styles.buttonContainer}>
            <LiquidGlassButton
              title="Submit feedback"
              onPress={handleSubmit}
              height={54}
              borderRadius={theme.borderRadius.button}
              tintColor={theme.colors.cta}
              shadowIntensity="medium"
              disabled={submitting}
            />
          </View>
        </ScrollView>
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingHorizontal: theme.spacing['6'],
      paddingTop: theme.spacing['6'],
      paddingBottom: theme.spacing['24'],
    },
    avatarTile: {
      width: 64,
      height: 64,
      borderRadius: theme.borderRadius.card,
      backgroundColor: theme.colors.blueSoft,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: 64,
      height: 64,
      borderRadius: theme.borderRadius.card,
    },
    avatarInitial: {
      ...theme.typography.serifTitleSmall,
      fontSize: 21,
      color: theme.colors.blueText,
    },
    title: {
      ...theme.typography.emptyStateTitle,
      color: theme.colors.ink,
      textAlign: 'center',
      marginTop: theme.spacing['2'],
    },
    subtitle: {
      ...theme.typography.bodySmall,
      color: theme.colors.inkMuted,
      textAlign: 'center',
      marginTop: theme.spacing['1'],
    },
    ratingSection: {
      alignItems: 'center',
      marginTop: theme.spacing['4'],
      marginBottom: theme.spacing['1'],
    },
    textArea: {
      width: '100%',
      backgroundColor: theme.colors.fieldBg,
      borderWidth: 1.5,
      borderColor: theme.colors.hairline,
      borderRadius: theme.borderRadius.field,
      paddingTop: theme.spacing['3.5'],
      paddingHorizontal: theme.spacing['4'],
      paddingBottom: theme.spacing['10'],
      minHeight: 96,
      marginTop: theme.spacing['3'],
    },
    input: {
      ...theme.typography.body,
      color: theme.colors.ink,
      padding: 0,
    },
    buttonContainer: {
      width: '100%',
      marginTop: theme.spacing['3'],
    },
  });
};

export default ReviewScreen;
