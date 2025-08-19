import {Alert, Image, View} from 'react-native';
import React from 'react';
import {Images} from '../../../utils';
import {scaledValue} from '../../../utils/design.utils';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import GText from '../../../components/GText/GText';
import GButton from '../../../components/GButton';
import {styles} from './styles';
import GTextButton from '../../../components/GTextButton/GTextButton';
import {colors} from '../../../../assets/colors';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {WEB_CLIENT_ID} from '../../../constants';
import {social_login} from '../../../redux/slices/authSlice';
import {useAppDispatch} from '../../../redux/store/storeUtils';

const SignupOptions = ({navigation}) => {
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  React.useEffect(() => {
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
    });
  }, []);

  const GoogleSingUp = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signIn().then(async result => {
        GoogleSignin.signOut();

        socialLogin(result?.data?.idToken, 'google');
      });
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === '-1') {
        // user cancelled the login flow
        Alert.alert('User cancelled the login flow !');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        Alert.alert('Signin in progress');
        // operation (f.e. sign in) is in progress already
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Google play services not available or outdated !');
        // play services not available or outdated
      } else {
        Alert.alert(`Getting error in GoogleSingIn with code: ${error.code}`);
      }
    }
  };
  const buttonList = [
    {
      id: 1,
      title: t('sign_up_email_string'),
      icon: Images.email,
      backgroundColor: colors.jetBlack,
      textColor: colors.paletteWhite,
      action: () => {
        navigation?.navigate('CreateAccount', {
          userDetails: {},
          apiCallImage: '',
        });
      },
    },
    {
      id: 2,
      title: t('sign_up_google_string'),
      icon: Images.google,
      backgroundColor: '#FFFFFF',
      textColor: '#344054',
      action: () => {
        GoogleSingUp();
      },
    },
    {
      id: 3,
      title: t('sign_up_fb_string'),
      icon: Images.fb,
      backgroundColor: '#1877F2',
      textColor: '#FFFEFE',
      action: () => {
        navigation?.navigate('CreateAccount');
      },
    },
    {
      id: 4,
      title: t('sign_up_apple_string'),
      icon: Images.apple,
      backgroundColor: colors.jetBlack,
      textColor: '#FFFEFE',
      action: () => {
        navigation?.navigate('CreateAccount');
      },
    },
  ];

  const socialLogin = (token, type) => {
    const input = {
      type: type,
      token_id: token,
    };
    dispatch(social_login(input)).then(res => {
      if (social_login.fulfilled.match(res)) {
        if (res?.payload?.status === 1) {
          navigation?.navigate('CreateAccount', {
            userDetails: res.payload.data,
          });
        }
      }
    });
  };

  return (
    <View style={styles.container}>
      <Image
        source={Images.signupOptions}
        style={[
          styles.signupImage,
          {marginTop: statusBarHeight + scaledValue(10)},
        ]}
      />
      <View style={styles.headerContainer}>
        <GText
          GrMedium
          text={t('tail_wagging_string')}
          style={styles.tailWaggingText}
        />
        <GText
          GrMedium
          text={` ${t('welcome_string')}`}
          style={styles.welcomeText}
        />
      </View>
      <View style={styles.buttonContainer}>
        {buttonList?.map(item => (
          <GButton
            key={item?.id}
            onPress={item?.action}
            title={item?.title}
            icon={item?.icon}
            iconStyle={styles.iconStyle}
            style={[
              styles.button,
              {backgroundColor: item?.backgroundColor},
              item?.id === 2 && styles.googleButtonBorder,
            ]}
            textStyle={[styles.buttonText, {color: item?.textColor}]}
          />
        ))}
      </View>
      <View style={styles.memberContainer}>
        <GText
          SatoshiBold
          text={t('already_member_string')}
          style={styles.alreadyMemberText}
        />
        <GTextButton
          onPress={() => navigation?.navigate('SignIn')}
          title={t('sign_in_string')}
          titleStyle={styles.signInText}
        />
      </View>
    </View>
  );
};

export default SignupOptions;
