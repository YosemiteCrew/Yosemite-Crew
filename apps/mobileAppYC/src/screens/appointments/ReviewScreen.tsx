import React, {useMemo, useState} from 'react';
import {ScrollView, View, Text, StyleSheet, TextInput} from 'react-native';
import {SafeArea} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {LiquidGlassButton} from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '@/hooks';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import RatingStars from '@/components/common/RatingStars/RatingStars';
import VetBusinessCard from '@/components/appointments/VetBusinessCard/VetBusinessCard';
import {useSelector} from 'react-redux';
import type {RootState} from '@/app/store';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

export const ReviewScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [review, setReview] = useState('');
  const [rating, setRating] = useState(4);
  const navigation = useNavigation<Nav>();
  const appointmentId = (navigation.getState() as any)?.routes?.slice(-1)[0]?.params?.appointmentId;
  const apt = useSelector((s: RootState) => s.appointments.items.find(a => a.id === appointmentId));
  const business = useSelector((s: RootState) => s.businesses.businesses.find(b => b.id === apt?.businessId));

  return (
    <SafeArea>
      <Header title="Review" showBackButton onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <View style={styles.checkmarkContainer}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
          <Text style={styles.title}>Consultation Complete</Text>
          <Text style={styles.subtitle}>Share feedback</Text>
        </View>

        {business && (
          <View style={styles.businessCardContainer}>
            <VetBusinessCard
              name={business.name}
              meta={business.address}
              photo={business.photo}
              cta=""
            />
            <View style={styles.ratingSection}>
              <Text style={styles.ratingLabel}>Rate {business.name}</Text>
              <RatingStars value={rating} onChange={setRating} />
            </View>
          </View>
        )}

        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Review</Text>
          <View style={styles.textArea}>
            <TextInput
              value={review}
              onChangeText={setReview}
              multiline
              placeholder="Your review"
              placeholderTextColor={theme.colors.textSecondary + '80'}
              style={styles.input}
              textAlignVertical="top"
            />
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <LiquidGlassButton
            title="Submit Feedback"
            onPress={() => navigation.goBack()}
            height={56}
            borderRadius={16}
            tintColor={theme.colors.secondary}
            shadowIntensity="medium"
          />
        </View>
      </ScrollView>
    </SafeArea>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    padding: theme.spacing[4],
    paddingBottom: theme.spacing[24],
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: theme.spacing[5],
  },
  checkmarkContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing[4],
  },
  checkmark: {
    fontSize: 36,
    color: '#10B981',
    fontWeight: '600',
  },
  title: {
    ...theme.typography.h3,
    color: theme.colors.secondary,
    marginBottom: theme.spacing[2],
    textAlign: 'center',
  },
  subtitle: {
    ...theme.typography.body14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  businessCardContainer: {
    marginBottom: theme.spacing[4],
  },
  ratingSection: {
    alignItems: 'center',
    marginTop: theme.spacing[4],
    gap: theme.spacing[3],
  },
  ratingLabel: {
    ...theme.typography.titleMedium,
    color: theme.colors.secondary,
  },
  reviewSection: {
    marginBottom: theme.spacing[4],
  },
  reviewLabel: {
    ...theme.typography.titleMedium,
    color: theme.colors.secondary,
    marginBottom: theme.spacing[3],
  },
  textArea: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[3],
    minHeight: 140,
    backgroundColor: theme.colors.inputBackground,
  },
  input: {
    ...theme.typography.body14,
    color: theme.colors.text,
    minHeight: 120,
  },
  buttonContainer: {
    marginTop: theme.spacing[2],
  },
});

export default ReviewScreen;
