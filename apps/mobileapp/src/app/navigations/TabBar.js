import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import HomeStack from './HomeStack';
import FastImage from 'react-native-fast-image';
import {StyleSheet, View} from 'react-native';
import {scaledHeightValue, scaledValue} from '../utils/design.utils';
import {Images} from '../utils';
import {colors} from '../../assets/colors';
import GText from '../components/GText/GText';
import {useTranslation} from 'react-i18next';
import AnimatedBottomTabBar from './AnimatedBottomTabBar';
import AccountStack from './AccountStack';
import AppointmentStack from './AppointmentStack';
import MyPetStack from './MyPetStack';

const BottomTab = createBottomTabNavigator();

const TabBar = props => {
  const {t} = useTranslation();

  const renderIcon = (focused, source, label) => (
    <View style={{alignItems: 'center', gap: scaledValue(4)}}>
      <FastImage
        source={focused ? source.focus : source.default}
        style={{width: scaledValue(24), height: scaledValue(24)}}
      />
      <GText
        text={t(label)}
        style={{
          fontFamily: 'SATOSHI_BLACK',
          fontSize: scaledValue(11),
          lineHeight: scaledHeightValue(14.4),
          color: focused ? colors.appRed : colors.darkPurple,
          opacity: focused ? 1 : 0.5,
        }}
      />
    </View>
  );

  return (
    <BottomTab.Navigator
      tabBar={props => <AnimatedBottomTabBar {...props} />}
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBarStyle,
        tabBarShowLabel: false,
      }}>
      <BottomTab.Screen
        name="Home"
        component={HomeStack}
        options={{
          tabBarIcon: ({focused}) =>
            renderIcon(
              focused,
              {focus: Images.HomeFocus, default: Images.Home},
              'home_string',
            ),
        }}
      />
      <BottomTab.Screen
        name="MyPets"
        component={MyPetStack}
        options={{
          tabBarIcon: ({focused}) =>
            renderIcon(
              focused,
              {focus: Images.MyPetsFocus, default: Images.MyPets},
              'my_pets_string',
            ),
        }}
      />
      <BottomTab.Screen
        name="Appointments"
        component={AppointmentStack}
        options={{
          tabBarIcon: ({focused}) =>
            renderIcon(
              focused,
              {focus: Images.AppointmentsFocus, default: Images.Appointments},
              'appointments_string',
            ),
        }}
      />
      <BottomTab.Screen
        name="AccountStack"
        component={AccountStack}
        options={{
          tabBarIcon: ({focused}) =>
            renderIcon(
              focused,
              {focus: Images.AccountFocus, default: Images.Account},
              'account_string',
            ),
        }}
      />
    </BottomTab.Navigator>
  );
};

export default TabBar;

const styles = StyleSheet.create({
  tabBarStyle: {},
});
