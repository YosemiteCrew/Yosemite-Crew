import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
import {confirm_signup} from '../../../redux/slices/authSlice';

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

  return (
    <KeyboardAvoidingView
      style={styles.scrollView}
      behavior={Platform.OS === 'ios' ? 'padding' : ''}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <TouchableOpacity
        onPress={() => {
          navigation?.goBack();
        }}
        style={styles.backButton}>
        <Image
          source={Images.Left_Circle_Arrow}
          style={styles.backButtonImage}
        />
      </TouchableOpacity>
      <ScrollView showsVerticalScrollIndicator={false}>
        <GText
          GrMedium
          text={''}
          style={[
            styles.createAccountText,
            {marginTop: scaledValue(statusBarHeight + scaledValue(17))},
          ]}
        />
        <GText
          SatoshiMedium
          text={'Verify your email address'}
          style={{
            textAlign: 'center',
            color: colors.darkPurple,
            fontSize: scaledValue(16),
            lineHeight: scaledHeightValue(21.6),
            letterSpacing: scaledValue(16 * -0.01),
            marginTop: scaledValue(35),
          }}
        />
        <GText
          SatoshiMedium
          text={
            'We emailed you a four-digit code to l@yopmail.com. Enter the code below to confirm your email address'
          }
          style={{
            textAlign: 'center',
            color: colors.cambridgeBlue,
            fontSize: scaledValue(15),
            lineHeight: scaledHeightValue(21.6),
            letterSpacing: scaledValue(15 * -0.01),
            marginTop: scaledValue(5),
          }}
        />
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
          onPress={() => {
            confirm_otp_hit();
          }}
          title={t('verify_code_string')}
          style={styles.createAccountButton}
          textStyle={styles.createAccountButtonText}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default ConfirmSignUp;
