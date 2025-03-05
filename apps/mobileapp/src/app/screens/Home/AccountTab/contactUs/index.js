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
import {contact_us} from '../../../../redux/slices/petSlice';
import {showToast} from '../../../../components/Toast';
import {useAppDispatch} from '../../../../redux/store/storeUtils';
import OptionMenuSheet from '../../../../components/OptionMenuSheet';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';

const ContactUs = ({navigation}) => {
  const {t} = useTranslation();
  const refRBSheet = useRef();
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const [subject, setSubject] = useState('');
  const [contactOption, setContactOption] = useState('general');
  const [selectTitle, setSelectTitle] = useState('General Enquiry');
  const [selectedSubmitRequest, setSelectedSubmitRequest] = useState('');
  const [selectedSubmitRequestTo, setSelectedSubmitRequestTo] = useState('');
  // const [selectedConfirmTerm, setSelectedConfirmTerm] = useState('');
  const [selectedConfirmTerms, setSelectedConfirmTerms] = useState([]);
  const toggleSelection = id => {
    setSelectedConfirmTerms(
      prevSelected =>
        prevSelected.includes(id)
          ? prevSelected.filter(item => item !== id) // Remove if already selected
          : [...prevSelected, id], // Add if not selected
    );
  };
  const [message, setMessage] = useState('');
  const [selectLaw, setSelectLaw] = useState('');
  const dispatch = useAppDispatch();

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
      onPress={() => {
        setContactOption(optionType);
        setSelectTitle(title);
        setMessage('');
        setSubject('');
      }}
      titleStyle={{
        color: contactOption === optionType ? colors.appRed : colors.darkPurple,
      }}
    />
  );

  const contactUs = () => {
    const input = {
      type: selectTitle,
      subject: subject,
      message: message,
    };

    const requests = [
      {
        question: 'You are submitting this request as',
        answer: selectedSubmitRequest?.name,
        type: 'requestAs',
      },
      {
        question: 'Under the rights of which law are you making this request?',
        answer: selectLaw?.title,
        type: 'laws',
      },
      {
        question: 'You are submitting this request to',
        answer: selectedSubmitRequestTo?.name,
        type: 'requestTo',
      },
    ];

    const DSARinput = {
      type: selectTitle,
      message: message,
      requests: JSON.stringify(requests),
    };
    console.log('DSARinput', DSARinput);

    if (contactOption === 'dsar') {
      if (
        !selectedSubmitRequest?.name ||
        !selectedSubmitRequestTo?.name ||
        !selectLaw?.title
      ) {
        showToast(
          0,
          'Please select submitting request as/submitting request to/select one law',
        );
      } else {
        dispatch(contact_us(contactOption == 'dsar' ? DSARinput : input)).then(
          res => {
            if (contact_us.fulfilled.match(res)) {
              setSubject('');
              setMessage('');
              setSelectedSubmitRequest({});
              setSelectedSubmitRequestTo({});
            }
          },
        );
      }
    } else {
      dispatch(contact_us(contactOption == 'dsar' ? DSARinput : input)).then(
        res => {
          if (contact_us.fulfilled.match(res)) {
            setSubject('');
            setMessage('');
            setSelectedSubmitRequest({});
            setSelectedSubmitRequestTo({});
          }
        },
      );
    }
  };

  return (
    <KeyboardAwareScrollView
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
              value={message}
              onChangeText={text => setMessage(text)}
              placeholder={t('your_message_string')}
              placeholderTextColor={'#aaa'}
              style={styles.textInputStyle}
            />
            <GButton
              onPress={contactUs}
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
                onPress={() => setSelectedSubmitRequest(item)}>
                <Image
                  source={
                    selectedSubmitRequest?.id == item?.id
                      ? Images.Circle_Radio
                      : Images.Circle_Button
                  }
                  style={styles.radioButton}
                />
                <GText
                  text={item?.name}
                  style={styles.submitRequestItemName(
                    selectedSubmitRequest?.id,
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
                refRBSheet?.current?.open();
              }}
              style={styles.professionalButton}>
              <GText
                SatoshiRegular
                text={selectLaw?.title || t('select_one_string')}
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
                onPress={() => setSelectedSubmitRequestTo(item)}>
                <Image
                  source={
                    selectedSubmitRequestTo?.id == item?.id
                      ? Images.Circle_Radio
                      : Images.Circle_Button
                  }
                  style={styles.radioButton}
                />
                <GText
                  text={item?.name}
                  style={styles.submitRequestItemName(
                    selectedSubmitRequestTo?.id,
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
              value={message}
              onChangeText={text => setMessage(text)}
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
                onPress={() => toggleSelection(item.id)}>
                <Image
                  source={
                    selectedConfirmTerms.includes(item.id)
                      ? Images.Check_fill
                      : Images.UnCheck
                  }
                  style={styles.radioButton}
                />
                <GText
                  text={item?.name}
                  style={styles.submitRequestItemName(
                    selectedConfirmTerms.includes(item.id),
                    item,
                  )}
                />
              </TouchableOpacity>
            ))}
            <GButton
              disabled={selectedConfirmTerms?.length < 3}
              onPress={contactUs}
              title={'Submit Request'}
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
      <OptionMenuSheet
        refRBSheet={refRBSheet}
        title={'Select Law'}
        options={lawsList}
        onChoose={val => {
          setSelectLaw(val);
          refRBSheet.current.close();
        }}
        onPressCancel={() => refRBSheet.current.close()}
      />
    </KeyboardAwareScrollView>
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

const lawsList = [
  {
    id: 0,
    title: 'Personal laws',
    textColor: '#3E3E3E',
  },
  {
    id: 1,
    title: 'Labour',
    textColor: '#3E3E3E',
  },
];

export default ContactUs;
