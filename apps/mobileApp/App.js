import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {Provider} from 'react-redux';
import store, {persistor} from './src/redux/store';
import {PersistGate} from 'redux-persist/integration/react';
import {
  createNavigationContainerRef,
  NavigationContainer,
} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {colors} from './assets/colors';
import TabBar from './src/navigations/TabBar';
import OnBoardingStack from './src/navigations/OnBoardingStack';
import AuthStack from './src/navigations/AuthStack';
import StackScreens from './src/navigations/StackScreens';
import SplashScreen from 'react-native-splash-screen';
import FlashMessage from 'react-native-flash-message';
import Spinner from 'react-native-loading-spinner-overlay';
import {useAppSelector} from './src/redux/store/storeUtils';
import AddPetStack from './src/navigations/AddPetStack';

export const navigationContainerRef = createNavigationContainerRef();

const App = () => {
  useEffect(() => {
    setTimeout(() => {
      SplashScreen.hide();
    }, 2000);
  }, []);
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <SafeAreaProvider>
          <StatusBar
            backgroundColor={colors.themeColor}
            barStyle="dark-content"
          />
          <AppNavigation />
        </SafeAreaProvider>
      </PersistGate>
    </Provider>
  );
};

export default App;

const AppNavigation = () => {
  const authState = useAppSelector(state => state.auth);
  const loading = useAppSelector(state => state.loading);
  const RootStack = createNativeStackNavigator();

  return (
    <>
      <NavigationContainer ref={navigationContainerRef}>
        <RootStack.Navigator
          screenOptions={{
            gestureEnabled: false,
          }}>
          {!authState?.onBoarding ? (
            <RootStack.Screen
              name="OnBoardingStack"
              component={OnBoardingStack}
              options={{headerShown: false}}
            />
          ) : !authState?.user ? (
            <RootStack.Screen
              name="AuthStack"
              component={AuthStack}
              options={{headerShown: false}}
            />
          ) : authState?.user?.isSkip === 0 ? (
            <RootStack.Screen
              name="AddPetStack"
              component={AddPetStack}
              options={{headerShown: false}}
            />
          ) : (
            <>
              <RootStack.Screen
                name="TabBar"
                component={TabBar}
                options={{headerShown: false}}
              />
              <RootStack.Screen
                name="StackScreens"
                component={StackScreens}
                options={{headerShown: false}}
              />
            </>
          )}
        </RootStack.Navigator>
        <FlashMessage position={'top'} floating={true} />
        <Spinner
          visible={loading?.loading}
          // indicatorStyle={{color: '#CF52C1'}}
        />
      </NavigationContainer>
    </>
  );
};
