import {
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useRef, useState} from 'react';
import {Images} from '../../../../utils';
import {styles} from './styles';
import {useTranslation} from 'react-i18next';
import {colors} from '../../../../../assets/colors';
import {scaledValue} from '../../../../utils/design.utils';
import GText from '../../../../components/GText/GText';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Input from '../../../../components/Input';
import GButton from '../../../../components/GButton';
import ContactOption from './ContactOption';

const ContactUs = ({navigation}) => {
  const {t} = useTranslation();
  const refRBSheet = useRef();
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const [subject, setSubject] = useState('');
  const [contactOption, setContactOption] = useState('general');
  const [selectedSubmitRequest, setSelectedSubmitRequest] = useState('');
  const [selectedSubmitRequestTo, setSelectedSubmitRequestTo] = useState('');
  const [selectedConfirmTerm, setSelectedConfirmTerm] = useState('');

  const options = [
    {type: 'general', title: 'General Enquiry'},
    {type: 'feature', title: 'Feature Request'},
    {type: 'dsar', title: 'Data Subject Access Request'},
  ];

  const renderContactOption = (optionType, title) => (
    <ContactOption
      icon={
        contactOption === optionType
          ? Images.Circle_Radio
          : Images.Circle_Button
      }
      title={title}
      onPress={() => setContactOption(optionType)}
      titleStyle={{
        color: contactOption === optionType ? colors.appRed : colors.darkPurple,
      }}
    />
  );

  return (
    <KeyboardAvoidingView
      style={styles.dashboardMainView}
      behavior={Platform.OS === 'ios' ? 'padding' : ''}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      {/* <View style={styles.dashboardMainView}> */}
      <ScrollView showsVerticalScrollIndicator={false}>
        <ImageBackground
          source={Images.ContactImg}
          style={[
            styles.imageBackground,
            {
              marginTop:
                Platform.OS == 'android' ? scaledValue(-20) : scaledValue(14),
            },
          ]}>
          <View
            style={[
              styles.headerView,
              {
                marginTop:
                  Platform.OS == 'android'
                    ? statusBarHeight + scaledValue(50)
                    : statusBarHeight,
              },
            ]}>
            <TouchableOpacity
              style={styles.headerLeft}
              onPress={() => {
                navigation?.goBack();
              }}>
              <Image
                source={Images.arrowLeftOutline}
                style={styles.headerIcon}
                tintColor={colors.darkPurple}
              />
            </TouchableOpacity>
            <GText GrMedium text="Contact us" style={styles.contactText} />
            <TouchableOpacity style={styles.headerRight} onPress={() => {}}>
              <Image source={Images.bellBold} style={styles.headerIcon} />
            </TouchableOpacity>
          </View>
        </ImageBackground>
        <View style={styles.helpTextContainer}>
          <GText GrMedium text="We’re happy" style={styles.happyText} />
          <GText GrMedium text=" to help" style={styles.helpText} />
        </View>
        <View style={styles.contactOptionMainView}>
          {options.map(option =>
            renderContactOption(option.type, option.title),
          )}
        </View>
        {['general', 'feature']?.includes(contactOption) && (
          <>
            <Input
              value={subject}
              label={t('subject_string')}
              onChangeText={value => setSubject(value)}
              style={styles.inputStyle}
            />
            <TextInput
              multiline={true}
              placeholder={t('your_message_string')}
              placeholderTextColor={'#aaa'}
              style={styles.textInputStyle}
            />
            <GButton
              title={'Send Message'}
              style={[
                styles.buttonStyle,
                {marginBottom: insets.bottom || scaledValue(20)},
              ]}
              textStyle={styles.buttonText}
            />
          </>
        )}
        {contactOption == 'dsar' && (
          <>
            <GText
              GrMedium
              text="You are submitting this request as"
              style={styles.optionTitleText}
            />

            {submitRequestList?.map((item, index) => (
              <TouchableOpacity
                key={item?.id}
                style={styles.submitRequestView(index, submitRequestList)}
                onPress={() => setSelectedSubmitRequest(item.id)}>
                <Image
                  source={
                    selectedSubmitRequest == item?.id
                      ? Images.Circle_Radio
                      : Images.Circle_Button
                  }
                  style={styles.radioButton}
                />
                <GText
                  text={item?.name}
                  style={styles.submitRequestItemName(
                    selectedSubmitRequest,
                    item,
                  )}
                />
              </TouchableOpacity>
            ))}
            <GText
              GrMedium
              text="Under the rights of which law are you making this request?"
              style={styles.underRightText}
            />
            <TouchableOpacity
              onPress={() => {
                // refRBSheet?.current?.open();
              }}
              style={styles.professionalButton}>
              <GText
                SatoshiRegular
                text={t('select_one_string')}
                style={styles.professionalText}
              />
              <Image source={Images.ArrowDown} style={styles.arrowIcon} />
            </TouchableOpacity>
            <GText
              GrMedium
              text="You are submitting this request to"
              style={styles.submittingRequestToText}
            />

            {submitRequestToList?.map((item, index) => (
              <TouchableOpacity
                key={item?.id}
                style={styles.submitRequestView(index, submitRequestToList)}
                onPress={() => setSelectedSubmitRequestTo(item.id)}>
                <Image
                  source={
                    selectedSubmitRequestTo == item?.id
                      ? Images.Circle_Radio
                      : Images.Circle_Button
                  }
                  style={styles.radioButton}
                />
                <GText
                  text={item?.name}
                  style={styles.submitRequestItemName(
                    selectedSubmitRequestTo,
                    item,
                  )}
                />
              </TouchableOpacity>
            ))}

            <GText
              GrMedium
              text="Please leave details regarding your action request or question"
              style={styles.leaveDetailsText}
            />
            <TextInput
              multiline={true}
              placeholder={t('your_message_string')}
              placeholderTextColor={'#aaa'}
              style={[
                styles.textInputStyle,
                {marginTop: scaledValue(8), marginBottom: scaledValue(36)},
              ]}
            />
            <GText
              GrMedium
              text="I Confirm that"
              style={[
                styles.leaveDetailsText,
                {marginTop: 0, marginBottom: scaledValue(16)},
              ]}
            />
            {confirmList?.map((item, index) => (
              <TouchableOpacity
                key={item?.id}
                style={styles.submitRequestView(index, confirmList)}
                onPress={() => setSelectedConfirmTerm(item.id)}>
                <Image
                  source={
                    selectedConfirmTerm == item?.id
                      ? Images.Check_fill
                      : Images.UnCheck
                  }
                  style={styles.radioButton}
                />
                <GText
                  text={item?.name}
                  style={styles.submitRequestItemName(
                    selectedConfirmTerm,
                    item,
                  )}
                />
              </TouchableOpacity>
            ))}
            <GButton
              title={'Sumbit Request'}
              style={[
                styles.buttonStyle,
                {
                  marginTop: scaledValue(42),
                  marginBottom: insets.bottom || scaledValue(20),
                },
              ]}
              textStyle={styles.buttonText}
            />
          </>
        )}
      </ScrollView>
      {/* <GMultipleOptions
        refRBSheet={refRBSheet}
        title="Are you a pet professional?"
        options={professionalList}
        search={false}
        value={selectProfessional}
        multiSelect={true}
        onChoose={val => {
          setSelectProfessional(val);
        }}
      /> */}
    </KeyboardAvoidingView>
  );
};

const submitRequestList = [
  {
    id: 1,
    name: 'The person, or the parent / guardian of the person, whose name appears above',
  },
  {
    id: 2,
    name: 'An agent authorized by the consumer to make this request on their behalf',
  },
];

const submitRequestToList = [
  {
    id: 1,
    name: 'Know what information is being collected from you',
  },
  {
    id: 2,
    name: 'Have your information deleted',
  },
  {
    id: 3,
    name: 'Opt-out of having your data sold to third-parties',
  },
  {
    id: 4,
    name: 'Opt-in to the sale of your personal data to third-parties',
  },
  {
    id: 5,
    name: 'Fix inaccurate information',
  },
  {
    id: 6,
    name: 'Receive a copy of your personal information',
  },
  {
    id: 7,
    name: 'Opt-out of having your data shared for cross-context behavioral advertising',
  },
  {
    id: 8,
    name: 'Limit the use and disclosure of your sensitive personal information',
  },
  {
    id: 9,
    name: 'Others (please specifiy in the comment box below)',
  },
];

const confirmList = [
  {
    id: 1,
    name: 'Under penalty of perjury, I declare all the above information to be true and accurate.',
  },
  {
    id: 2,
    name: 'I understand that the deletion or restriction of my personal data is irreversible and may result in the termination of services with Yosemite Crew.',
  },
  {
    id: 3,
    name: 'I understand that I will be required to validate my request my email, and I may be contacted in order to complete the request.',
  },
];

export default ContactUs;
