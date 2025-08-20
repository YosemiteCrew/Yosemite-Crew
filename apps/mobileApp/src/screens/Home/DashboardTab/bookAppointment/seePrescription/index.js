import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
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
import {
  scaledHeightValue,
  scaledValue,
} from '../../../../../utils/design.utils';
import {useAppDispatch} from '../../../../../redux/store/storeUtils';
import {
  delete_a_feedback,
  get_feedback_list,
  save_a_feedback,
  update_a_feedback,
} from '../../../../../redux/slices/feedbackSlince';
import {createObservation} from '../../../../../helpers/createObservation';
import {transformObservations} from '../../../../../helpers/transformObservations';
import GImage from '../../../../../components/GImage';
import {updateObservation} from '../../../../../helpers/updateObservation';

const SeePrescription = ({navigation, route}) => {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const {appointmentDetail} = route?.params;
  const [rating, setRating] = useState();
  const [feedBackDetail, setFeedBackDetail] = useState();
  const [showFeedback, setShowFeedBack] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    configureHeader();
    setRating(feedBackDetail?.rating);
    setMessage(feedBackDetail?.feedbackText);
  }, [feedBackDetail?.feedbackText]);

  const configureHeader = () => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  };

  useEffect(() => {
    get_feedBack();
  }, []);

  const get_feedBack = () => {
    const api_credentials = {
      doctorId: appointmentDetail?.vetId,
      meetingId: appointmentDetail?.id,
    };
    dispatch(get_feedback_list(api_credentials)).then(res => {
      if (get_feedback_list.fulfilled.match(res)) {
        const transform = transformObservations(res.payload?.data?.entry);
        if (transform?.length > 0) {
          setShowFeedBack(true);
        }
        setFeedBackDetail(transform[0]);
      }
    });
  };

  const edit_feedBack = () => {
    const api_credentials = {
      patientId: appointmentDetail?.petId,
      feedback: message,
      rating: Number(rating),
    };

    const fhirPayload = {
      fhirData: {
        data: updateObservation(api_credentials),
      },
      feedBackId: feedBackDetail?.feedBackId,
    };
    dispatch(update_a_feedback(fhirPayload)).then(res => {
      if (update_a_feedback.fulfilled.match(res)) {
        setShowFeedBack(true);

        const transform = transformObservations(res.payload?.data?.entry);
        setFeedBackDetail(transform[0]);

        // setFeedBackDetail(transform[0]);
      }
    });
  };

  const handleRatingChange = rating => {
    setRating(rating);
  };

  const save_feedBack = () => {
    const api_credentials = {
      appointmentId: appointmentDetail?.id,
      patientId: appointmentDetail?.petId,
      practitionerId: appointmentDetail?.vetId,
      valueString: message,
      rating: Number(rating),
    };

    const fhirPayload = {
      data: createObservation(api_credentials),
    };

    dispatch(save_a_feedback(fhirPayload)).then(res => {
      if (save_a_feedback.fulfilled.match(res)) {
        setShowFeedBack(true);

        const transform = transformObservations(res.payload?.data?.entry);
        setFeedBackDetail(transform[0]);
      }
    });
  };

  const delete_feedback = () => {
    const input = {
      feedBackId: feedBackDetail?.feedBackId,
    };
    dispatch(delete_a_feedback(input)).then(res => {
      if (delete_a_feedback.fulfilled.match(res)) {
        setFeedBackDetail();
        setShowFeedBack(false);
        setRating(0);
      }
    });
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
              <GText
                GrMedium
                text={appointmentDetail?.pet?.name}
                style={styles.prescriptionName}
              />
            </View>
            <GText
              SatoshiBold
              text={`Dr. ${appointmentDetail?.vet?.name}`}
              style={styles.textStyle}
            />
            <GText
              SatoshiBold
              text={appointmentDetail?.location}
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
          text={
            showFeedback
              ? `${t('your_feedback_string')}`
              : `${t('share_feedback_string')}`
          }
          style={styles.shareFeedbackText}
        />
        {showFeedback ? (
          <View style={{marginBottom: scaledValue(62)}}>
            <View
              style={[
                styles.feedbackContainer,
                {
                  paddingVertical: scaledValue(40),
                  alignItems: 'baseline',
                  paddingHorizontal: scaledValue(32),
                },
              ]}>
              <View style={{flexDirection: 'row'}}>
                <View
                  style={{
                    borderWidth: scaledValue(1),
                    borderRadius: scaledValue(12),
                    borderColor: '#CB822F80',
                  }}>
                  <GImage
                    image={appointmentDetail?.vet?.image}
                    style={{
                      width: scaledValue(60),
                      height: scaledHeightValue(60),
                      borderRadius: scaledValue(12),
                    }}
                  />
                </View>
                <View style={{marginLeft: scaledValue(8)}}>
                  <GText
                    GrMedium
                    text={`Dr. ${appointmentDetail?.vet?.name}`}
                    style={[
                      styles.doctorName,
                      {
                        color: '#000000',
                        fontSize: scaledValue(18),
                        letterSpacing: scaledValue(18 * -0.01),
                      },
                    ]}
                  />
                  <GText
                    SatoshiBold
                    text={appointmentDetail?.vet?.specialization}
                    style={styles.doctorSpeciality}
                  />
                </View>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  paddingTop: scaledValue(20.5),
                }}>
                <GText
                  GrMedium
                  text={feedBackDetail?.date}
                  style={{fontSize: scaledValue(16), color: colors.jetBlack}}
                />
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: scaledValue(5.67),
                  }}>
                  <Image
                    source={Images.Star}
                    style={{
                      width: scaledValue(16.67),
                      height: scaledValue(16.67),
                    }}
                  />
                  <GText
                    GrMedium
                    text={feedBackDetail?.rating?.toFixed(1)}
                    style={{
                      fontSize: scaledValue(16),
                      color: colors.jetBlack,
                    }}
                  />
                </View>
              </View>
              <GText
                SatoshiRegular
                text={feedBackDetail?.feedbackText}
                style={{
                  fontSize: scaledValue(16),
                  letterSpacing: scaledValue(16 * -0.02),
                  lineHeight: scaledHeightValue(16 * 1.4),
                  marginTop: scaledValue(12),
                  color: colors.jetBlack,
                }}
              />
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: scaledValue(40),
                paddingTop: scaledValue(24),
              }}>
              <TouchableOpacity
                onPress={() => {
                  setShowFeedBack(false);
                }}
                activeOpacity={0.7}
                style={{gap: scaledValue(4), alignItems: 'center'}}>
                <Image source={Images.Pen} style={styles.penImg} />
                <GText
                  SatoshiBold
                  text={'Edit'}
                  style={{fontSize: scaledValue(14), color: colors.appRed}}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={delete_feedback}
                activeOpacity={0.7}
                style={{gap: scaledValue(4), alignItems: 'center'}}>
                <Image source={Images.trashFull} style={styles.penImg} />
                <GText
                  SatoshiBold
                  text={'Delete'}
                  style={{fontSize: scaledValue(14), color: colors.appRed}}
                />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.feedbackContainer}>
              <Image source={Images.DoctorImg} style={styles.doctorImage} />
              <GText
                GrMedium
                text={`Dr. ${appointmentDetail?.vet?.name}`}
                style={styles.doctorName}
              />
              <GText
                SatoshiBold
                text={appointmentDetail?.vet?.specialization}
                style={styles.doctorSpeciality}
              />
              <GText
                GrMedium
                text={`Rate Dr. ${
                  appointmentDetail?.vet?.name?.split(' ')[0]
                }’s Help`}
                style={styles.rateDoctorText}
              />
              <View style={styles.ratingContainer}>
                <CustomRating
                  maxRating={5}
                  value={rating}
                  filledStar={Images.Star}
                  unfilledStar={Images.StarUnFill}
                  onRatingChange={handleRatingChange}
                  imageStyle={styles.starImage}
                  starContainerStyle={{
                    marginHorizontal: scaledValue(4),
                  }}
                />
              </View>
            </View>
            <GText
              GrMedium
              text={`${t('review_string')}`}
              style={styles.reviewText}
            />
            <TextInput
              value={message}
              multiline
              placeholderTextColor={colors.darkPurple2}
              placeholder={t('your_review_string')}
              onChangeText={setMessage}
              style={styles.inputStyle}
            />

            <GButton
              onPress={
                feedBackDetail?.feedBackId ? edit_feedBack : save_feedBack
              }
              title={t('submit_feedback_string')}
              textStyle={styles.buttonText}
              style={styles.buttonStyle}
            />
          </>
        )}
      </ScrollView>
      {/* </View> */}
    </KeyboardAvoidingView>
  );
};

export default SeePrescription;
