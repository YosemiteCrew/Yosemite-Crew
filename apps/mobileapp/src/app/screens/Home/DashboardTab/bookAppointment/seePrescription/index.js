import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import HeaderButton from '../../../../../components/HeaderButton';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import GButton from '../../../../../components/GButton';
import CustomRating from '../../../../../components/CustomRating';
import Input from '../../../../../components/Input';
import {scaledValue} from '../../../../../utils/design.utils';

const SeePrescription = ({navigation}) => {
  const {t} = useTranslation();
  const [message, setMessage] = useState('');
  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.darkPurple}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  };

  const handleRatingChange = rating => {
    console.log('Selected Rating:', rating);
  };

  return (
    <KeyboardAvoidingView
      style={styles.dashboardMainView}
      behavior={Platform.OS === 'ios' ? 'padding' : ''}
      keyboardVerticalOffset={Platform.OS === 'ios' ? scaledValue(40) : 0}>
      {/* <View style={styles.dashboardMainView}> */}
      <ScrollView style={styles.scrollView}>
        <View style={styles.row}>
          <Image source={Images.File} style={styles.fileImage} />
          <View style={styles.prescriptionInfo}>
            <View style={styles.row}>
              <GText
                GrMedium
                text={`${t('prescription_for_string')} `}
                style={styles.prescriptionText}
              />
              <GText GrMedium text={`Kizie`} style={styles.prescriptionName} />
            </View>
            <GText
              SatoshiBold
              text={`Dr. Emily Johnson`}
              style={styles.textStyle}
            />
            <GText
              SatoshiBold
              text={`San Francisco Animal Medical Center`}
              style={styles.textStyle}
            />
            <GText
              SatoshiBold
              text={`13 August 2024`}
              style={styles.textStyle}
            />
          </View>
        </View>
        <Image source={Images.Prescription} style={styles.prescriptionImage} />
        <GButton
          onPress={() => {
            navigation?.navigate('StackScreens', {
              screen: 'ChatScreen',
            });
          }}
          title={t('see_chat_history_string')}
          style={styles.chatButton}
          textStyle={styles.chatButtonText}
        />
        <GText
          GrMedium
          text={`${t('share_feedback_string')}`}
          style={styles.shareFeedbackText}
        />
        <View style={styles.feedbackContainer}>
          <Image source={Images.DoctorImg} style={styles.doctorImage} />
          <GText GrMedium text={`Dr. David Brown`} style={styles.doctorName} />
          <GText
            SatoshiBold
            text={`Gastroenterology`}
            style={styles.doctorSpeciality}
          />
          <GText
            GrMedium
            text={`Rate Dr. David’s Help`}
            style={styles.rateDoctorText}
          />
          <View style={styles.ratingContainer}>
            <CustomRating
              maxRating={5}
              size={40}
              onRatingChange={handleRatingChange}
            />
          </View>
        </View>
        <GText
          GrMedium
          text={`${t('review_string')}`}
          style={styles.reviewText}
        />
        <Input
          value={message}
          multiline
          label={t('your_review_string')}
          onChangeText={setMessage}
          style={styles.inputStyle}
        />
        <GButton
          title={t('submit_feedback_string')}
          textStyle={styles.buttonText}
          style={styles.buttonStyle}
        />
      </ScrollView>
      {/* </View> */}
    </KeyboardAvoidingView>
  );
};

export default SeePrescription;
