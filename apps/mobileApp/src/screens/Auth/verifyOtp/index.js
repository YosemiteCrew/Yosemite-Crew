import {Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import React, {useEffect, useState} from 'react';
import {colors} from '../../../../assets/colors';
import {Images} from '../../../utils';
import {scaledHeightValue, scaledValue} from '../../../utils/design.utils';
import GText from '../../../components/GText/GText';
import HeaderButton from '../../../components/HeaderButton';
import {useTranslation} from 'react-i18next';
import {fonts} from '../../../utils/fonts';
import {
  CodeField,
  Cursor,
  useBlurOnFulfill,
  useClearByFocusCell,
} from 'react-native-confirmation-code-field';
import {styles} from './styles';
import GButton from '../../../components/GButton';
import GTextButton from '../../../components/GTextButton/GTextButton';
import Modal from 'react-native-modal';
import {useAppDispatch} from '../../../redux/store/storeUtils';
import {
  resend_otp,
  send_otp_sign_in,
  setUserData,
  sign_in,
} from '../../../redux/slices/authSlice';
import {maskEmail} from '../../../utils/constants';
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';

const CELL_COUNT = 6;

const VerifyOtp = ({navigation, route}) => {
  const {email} = route?.params;
  const {t} = useTranslation();
  const [value, setValue] = useState('');
  const [isModalVisible, setModalVisible] = useState(false);
  const [success, setSuccess] = useState(false);
  const [data, setData] = useState({});
  const toggleModal = () => {
    setModalVisible(!isModalVisible);
  };

  const ref = useBlurOnFulfill({value, cellCount: CELL_COUNT});
  const [props, getCellOnLayoutHandler] = useClearByFocusCell({
    value,
    setValue,
  });

  useEffect(() => {
    if (!success) {
      configureHeader();
    }
  }, [success]);

  const configureHeader = () => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          style={{marginLeft: scaledValue(20)}}
          onPress={() => navigation.goBack()}
        />
      ),
      headerTitle: () => (
        <GText
          GrMedium
          text="Enter Login Code"
          style={{
            fontSize: scaledValue(20),
            letterSpacing: scaledValue(20 * -0.01),
            color: colors.jetBlack,
          }}
        />
      ),
    });
  };
  const dispatch = useAppDispatch();
  const sign_in_hit = () => {
    let input = {
      email: email,
      otp: Number(value),
    };

    dispatch(sign_in(input)).then(res => {
      if (sign_in.fulfilled.match(res)) {
        if (res?.payload?.status === 1) {
          setData(res?.payload?.userdata);
          setSuccess(true);
          setModalVisible(true);
          setTimeout(() => {
            dispatch(setUserData(res?.payload?.userdata));
          }, 3000);
        }
      }
    });
  };

  const resendOtp = () => {
    let input = {
      email: email,
    };

    dispatch(send_otp_sign_in(input)).then(res => {
      if (send_otp_sign_in.fulfilled.match(res)) {
        if (res?.payload?.status === 1) {
          setValue('');
        }
      }
    });
  };

  return (
    <View style={{flex: 1, backgroundColor: colors.paletteWhite}}>
      {!success && (
        <KeyboardAwareScrollView
          bottomOffset={20}
          style={{
            flex: 1,
            backgroundColor: colors.paletteWhite,
            paddingHorizontal: scaledValue(20),
          }}>
          <Image
            source={Images.Lost_Password}
            style={{
              width: '100%',
              height: scaledValue(162),
              marginTop: scaledValue(68),
              alignSelf: 'center',
            }}
          />
          <GText
            GrMedium
            text={t('check_email_string')}
            style={{
              textAlign: 'center',
              marginTop: scaledValue(82),
              fontSize: scaledValue(26),
              letterSpacing: scaledValue(26 * -0.01),
              color: colors.jetBlack,
            }}
          />

          <Text
            style={{
              textAlign: 'center',
              marginTop: scaledValue(16),
              color: colors.jetBlack300,
              fontFamily: fonts.SATOSHI_REGULAR,
              fontSize: scaledValue(16),
            }}>
            We've sent a login code to{' '}
            <Text
              style={{fontFamily: fonts.SATOSHI_BOLD, color: colors.jetBlack}}>
              {maskEmail(email)}
            </Text>
            . Please enter the 6-digit code sent in the email.
          </Text>
          <CodeField
            ref={ref}
            {...props}
            value={value}
            onChangeText={setValue}
            cellCount={CELL_COUNT}
            rootStyle={styles.rootStyle}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            renderCell={({index, symbol, isFocused}) => (
              <View
                key={index}
                style={[
                  styles.codeView,
                  isFocused && {borderColor: '#0B0E10', color: '#0B0E10'},
                ]}
                onLayout={getCellOnLayoutHandler(index)}>
                <Text style={styles.codeText}>
                  {symbol || (isFocused ? <Cursor /> : null)}
                </Text>
              </View>
            )}
          />
          <GButton
            disabled={value.length < CELL_COUNT}
            onPress={() => {
              sign_in_hit();
            }}
            title={'Verify Code'}
            iconStyle={styles.iconStyle}
            style={[styles.socialButton]}
            textStyle={[styles.socialButtonText]}
          />
          <View style={styles.notMemberContainer}>
            <GText
              SatoshiBold
              text={t('not_get_email_string')}
              style={styles.notMemberText}
            />
            <GTextButton
              onPress={resendOtp}
              title={` ${t('resend_email_string')}`}
              titleStyle={styles.signUpText}
            />
          </View>
        </KeyboardAwareScrollView>
      )}

      <Modal
        // onBackdropPress={() => setModalVisible(false)}
        isVisible={isModalVisible}>
        <View style={styles.modalView}>
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              resizeMode: 'contain',
            }}
            onPress={() => dispatch(setUserData(data))}>
            <Image style={styles.greyCrossIcon} source={Images.greyCrossIcon} />
          </TouchableOpacity>
          <Image
            style={styles.verificationModal}
            source={Images.verification_modal}
          />
          <GText
            GrMedium
            text={'Congratulation 🎉 \n Code Verified '}
            style={styles.modalHeader}
          />
          <Text style={styles.modalContent}>
            The Code Sent to your email {'\n'}
            <Text style={styles.emailText}> {email} </Text> has been
            {'\n'}successfully verified
          </Text>
        </View>
      </Modal>
    </View>
  );
};

export default VerifyOtp;
