import React, { useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '@/hooks';
import { SafeArea } from '@/shared/components/common';
import { Header } from '@/shared/components/common/Header/Header';
import { Input } from '@/shared/components/common';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import { SimpleDatePicker, formatDateForDisplay } from '@/shared/components/common/SimpleDatePicker/SimpleDatePicker';
import { TouchableInput } from '@/shared/components/common/TouchableInput/TouchableInput';
import { Images } from '@/assets/images';
import type { AdverseEventStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AdverseEventStackParamList, 'Step5'>;

export const Step5Screen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [formData, setFormData] = useState({
    productName: '',
    brandName: '',
    manufacturingPlace: '',
    batchNumber: '',
    frequencyUsed: '',
    quantityUsed: '',
    quantityUnit: 'tablet' as 'tablet' | 'liquid',
    administrationMethod: 'on the skin',
    reasonToUseProduct: '',
    petConditionBefore: '',
    petConditionAfter: '',
    eventDate: new Date(),
  });

  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleSubmit = () => {
    navigation.navigate('ThankYou');
  };

  return (
    <SafeArea>
      <Header
        title="Adverse event reporting"
        showBackButton
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepTitle}>Step 5 of 5</Text>
        <Text style={styles.sectionTitle}>Product Information</Text>

        <Input
          label="Product name"
          value={formData.productName}
          onChangeText={text => setFormData({ ...formData, productName: text })}
          containerStyle={styles.input}
        />

        <Input
          label="Brand name"
          value={formData.brandName}
          onChangeText={text => setFormData({ ...formData, brandName: text })}
          containerStyle={styles.input}
        />

        <Input
          label="Manufacturing place"
          value={formData.manufacturingPlace}
          onChangeText={text => setFormData({ ...formData, manufacturingPlace: text })}
          containerStyle={styles.input}
        />

        <Input
          label="Batch number"
          value={formData.batchNumber}
          onChangeText={text => setFormData({ ...formData, batchNumber: text })}
          containerStyle={styles.input}
        />

        <Input
          label="Number of times product used"
          value={formData.frequencyUsed}
          onChangeText={text => setFormData({ ...formData, frequencyUsed: text })}
          keyboardType="numeric"
          containerStyle={styles.input}
        />

        <Input
          label="Quantity used"
          value={formData.quantityUsed}
          onChangeText={text => setFormData({ ...formData, quantityUsed: text })}
          containerStyle={styles.input}
        />

        <View style={styles.checkboxRow}>
          <View style={styles.checkbox}>
            <View style={[styles.checkboxInner, formData.quantityUnit === 'tablet' && styles.checked]} />
          </View>
          <Text style={styles.checkboxLabel}>Tablet - Piece</Text>

          <View style={[styles.checkbox, { marginLeft: theme.spacing[4] }]}>
            <View style={[styles.checkboxInner, formData.quantityUnit === 'liquid' && styles.checked]} />
          </View>
          <Text style={styles.checkboxLabel}>Liquid - ML</Text>
        </View>

        <Input
          label="How was the product administered?"
          value={formData.administrationMethod}
          editable={false}
          containerStyle={styles.input}
          icon={<Image source={Images.dropdownIcon} style={styles.dropdownIcon} />}
        />

        <Input
          label="Reason to use the product."
          value={formData.reasonToUseProduct}
          onChangeText={text => setFormData({ ...formData, reasonToUseProduct: text })}
          multiline
          containerStyle={styles.input}
        />

        <Input
          label="Pet condition before drug"
          value={formData.petConditionBefore}
          onChangeText={text => setFormData({ ...formData, petConditionBefore: text })}
          multiline
          containerStyle={styles.input}
        />

        <Input
          label="Pet condition after drug"
          value={formData.petConditionAfter}
          onChangeText={text => setFormData({ ...formData, petConditionAfter: text })}
          multiline
          containerStyle={styles.input}
        />

        <View style={styles.uploadSection}>
          <Text style={styles.uploadLabel}>Please add image of the product used.</Text>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={() => console.log('Upload image')}
          >
            <Image source={Images.uploadIcon} style={styles.uploadIcon} />
            <Text style={styles.uploadText}>Upload image</Text>
          </TouchableOpacity>
        </View>

        <TouchableInput
          label="Event date"
          value={formatDateForDisplay(formData.eventDate)}
          onPress={() => setShowDatePicker(true)}
          rightComponent={<Image source={Images.calendarIcon} style={styles.calendarIcon} />}
          containerStyle={styles.input}
        />

        <View style={styles.buttonContainer}>
          <LiquidGlassButton
            title="Next"
            onPress={handleSubmit}
            glassEffect="clear"
            interactive
            borderRadius="lg"
            forceBorder
            borderColor={theme.colors.borderMuted}
            height={56}
            style={styles.button}
            textStyle={styles.buttonText}
            tintColor={theme.colors.secondary}
            shadowIntensity="medium"
          />
        </View>
      </ScrollView>

      <SimpleDatePicker
        value={formData.eventDate}
        onDateChange={date => {
          setFormData({ ...formData, eventDate: date });
          setShowDatePicker(false);
        }}
        show={showDatePicker}
        onDismiss={() => setShowDatePicker(false)}
        maximumDate={new Date()}
        mode="date"
      />
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    scrollContent: {
      paddingHorizontal: theme.spacing[4],
      paddingTop: theme.spacing[4],
      paddingBottom: theme.spacing[24],
    },
    stepTitle: {
      ...theme.typography.labelMdBold,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing[4],
    },
    sectionTitle: {
      ...theme.typography.labelMdBold,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[4],
    },
    input: {
      marginBottom: theme.spacing[4],
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing[4],
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: theme.colors.borderMuted,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.spacing[2],
    },
    checkboxInner: {
      width: 12,
      height: 12,
      borderRadius: 2,
      backgroundColor: 'transparent',
    },
    checked: {
      backgroundColor: theme.colors.primary,
    },
    checkboxLabel: {
      ...theme.typography.body,
      color: theme.colors.secondary,
    },
    dropdownIcon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
    },
    uploadSection: {
      marginBottom: theme.spacing[6],
    },
    uploadLabel: {
      ...theme.typography.labelMdBold,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[3],
    },
    uploadButton: {
      borderWidth: 2,
      borderColor: theme.colors.primary,
      borderStyle: 'dashed',
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing[8],
      alignItems: 'center',
      justifyContent: 'center',
    },
    uploadIcon: {
      width: 40,
      height: 40,
      resizeMode: 'contain',
      marginBottom: theme.spacing[2],
      tintColor: theme.colors.primary,
    },
    uploadText: {
      ...theme.typography.labelMdBold,
      color: theme.colors.primary,
    },
    calendarIcon: {
      width: theme.spacing[5],
      height: theme.spacing[5],
      tintColor: theme.colors.textSecondary,
    },
    buttonContainer: {
      marginTop: theme.spacing[4],
    },
    button: {
      width: '100%',
      backgroundColor: theme.colors.secondary,
      borderRadius: theme.borderRadius.lg,
    },
    buttonText: {
      color: theme.colors.white,
      ...theme.typography.paragraphBold,
    },
  });
