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
    import {useAppDispatch, useAppSelector} from './src/redux/store/storeUtils';
    import {MenuProvider} from 'react-native-popup-menu';
    import {KeyboardProvider} from 'react-native-keyboard-controller';
    import {setLoading} from './src/redux/slices/loadingSlice';

    // Define the Param List for type safety
    export type RootStackParamList = {
      OnBoardingStack: undefined;
      AuthStack: undefined;
      TabBar: undefined;
      StackScreens: undefined;
    };

    // Apply the Param List to the navigation ref
    export const navigationContainerRef = createNavigationContainerRef<RootStackParamList>();

    const App: React.FC = () => {
      useEffect(() => {
        setTimeout(() => {
          SplashScreen.hide();
        }, 2000);
      }, []);
      return (
        <Provider store={store}>
          <MenuProvider>
            <PersistGate loading={null} persistor={persistor}>
              <SafeAreaProvider>
                <StatusBar
                  backgroundColor={colors.themeColor}
                  barStyle="dark-content"
                />
                <KeyboardProvider navigationBarTranslucent statusBarTranslucent>
                  <AppNavigation />
                </KeyboardProvider>
              </SafeAreaProvider>
            </PersistGate>
          </MenuProvider>
        </Provider>
      );
    };

    export default App;

    const AppNavigation: React.FC = () => {
      const authState = useAppSelector(state => state.auth);
      const loading = useAppSelector(state => state.loading);
      // Apply the Param List to the navigator
      const RootStack = createNativeStackNavigator<RootStackParamList>();
      const dispatch = useAppDispatch();

      useEffect(() => {
        // Note: You may want to reconsider setting loading to false on every render.
        // This is likely just for initialization.
        dispatch(setLoading(false));
      }, [dispatch]);

      return (
        <>
          <NavigationContainer ref={navigationContainerRef}>
            <RootStack.Navigator
              {...({ id: 'root', screenOptions: { gestureEnabled: false } } as any)}
            >
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
            />
          </NavigationContainer>
        </>
      );
    };