import {Image, View} from 'react-native';
import React from 'react';
import {Images} from '../../../utils';
import {scaledValue} from '../../../utils/design.utils';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import GText from '../../../components/GText/GText';
import GButton from '../../../components/GButton';
import {styles} from './styles';
import GTextButton from '../../../components/GTextButton/GTextButton';

const SignupOptions = ({navigation}) => {
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const {t} = useTranslation();

  const buttonList = [
    {
      id: 1,
      title: t('sign_up_email_string'),
      icon: Images.email,
      backgroundColor: '#FDBD74',
      textColor: '#37223C',
      action: () => {
        navigation?.navigate('CreateAccount');
      },
    },
    {
      id: 2,
      title: t('sign_up_google_string'),
      icon: Images.google,
      backgroundColor: '#FFFFFF',
      textColor: '#344054',
      action: () => {
        navigation?.navigate('CreateAccount');
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
      backgroundColor: '#000000',
      textColor: '#FFFEFE',
      action: () => {
        navigation?.navigate('CreateAccount');
      },
    },
  ];

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
