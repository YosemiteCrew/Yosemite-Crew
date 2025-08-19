import {Image, Text, View} from 'react-native';
import React, {useEffect, useState} from 'react';
import GText from '../../../components/GText/GText';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAppDispatch} from '../../../redux/store/storeUtils';
import {useTranslation} from 'react-i18next';
import {scaledHeightValue, scaledValue} from '../../../utils/design.utils';
import {styles} from './styles';
import {colors} from '../../../../assets/colors';
import {
  CodeField,
  Cursor,
  useBlurOnFulfill,
  useClearByFocusCell,
} from 'react-native-confirmation-code-field';
import GButton from '../../../components/GButton';
import {Images} from '../../../utils';
import {confirm_signup, resend_otp} from '../../../redux/slices/authSlice';
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';
import {fonts} from '../../../utils/fonts';
import GTextButton from '../../../components/GTextButton/GTextButton';
import {maskEmail} from '../../../utils/constants';

const CELL_COUNT = 6;

const ConfirmSignUp = ({navigation, route}) => {
  const {email} = route?.params;
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const dispatch = useAppDispatch();
  const {t} = useTranslation();
  const [value, setValue] = useState('');
  const ref = useBlurOnFulfill({value, cellCount: CELL_COUNT});
  const [props, getCellOnLayoutHandler] = useClearByFocusCell({
    value,
    setValue,
  });
  const [timerCount, setTimer] = useState();
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    if (timerCount > 0) {
      let interval = setInterval(() => {
        setTimer(lastTimerCount => {
          lastTimerCount <= 1 && clearInterval(interval);
          return lastTimerCount - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [timerCount]);

  const confirm_otp_hit = () => {
    let input = {
      email: email,
      confirmationCode: value,
    };
    dispatch(confirm_signup(input));
  };

  const resendOtp = () => {
    let input = {
      email: email,
    };
    dispatch(resend_otp(input));
  };

  return (
    <KeyboardAwareScrollView bottomOffset={20} style={styles.scrollView}>
      <GText
        GrMedium
        text={t('verify_account_string')}
        style={[
          styles.createAccountText,
          {marginTop: scaledValue(statusBarHeight + scaledValue(17))},
        ]}
      />
      <Image
        source={Images.verify_code}
        style={{
          width: scaledValue(260.44),
          height: scaledValue(103.27),
          alignSelf: 'center',
          marginTop: scaledValue(92),
        }}
      />
      <GText
        GrMedium
        text={t('check_email_string')}
        style={{
          textAlign: 'center',
          fontSize: scaledValue(26),
          letterSpacing: scaledValue(26 * -0.01),
          marginTop: scaledValue(82 + 35),
        }}
      />
      <Text
        style={{
          textAlign: 'center',
          color: colors.jetBlack300,
          fontSize: scaledValue(16),
          lineHeight: scaledHeightValue(21.6),
          letterSpacing: scaledValue(16 * -0.02),
          marginTop: scaledValue(16),
          fontFamily: fonts.SATOSHI_REGULAR,
        }}>
        {"We've sent a verify code to "}
        <Text style={{fontFamily: fonts.SATOSHI_BOLD, color: colors.jetBlack}}>
          {maskEmail(email)}
        </Text>
        <Text
          onPress={() => navigation.navigate('Privacy')}
          style={styles.link}>
          {'. Please enter the 6-digit code sent in the email.'}
        </Text>
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
          confirm_otp_hit();
        }}
        title={t('verify_code_string')}
        style={styles.createAccountButton}
      />
      <View
        style={{
          flexDirection: 'row',
          marginTop: scaledValue(16),
          alignSelf: 'center',
        }}>
        <GText
          SatoshiBold
          text={'Haven’t got the email yet? '}
          style={{fontSize: scaledValue(16), color: colors.jetBlack300}}
        />
        <GTextButton onPress={resendOtp} title={'Resend email'} />
      </View>
    </KeyboardAwareScrollView>
  );
};

export default ConfirmSignUp;
