/* eslint-disable react-native/no-inline-styles */
/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */
import React, {useEffect, useState} from 'react';
import {StatusBar, LogBox} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {Provider} from 'react-redux';
import {PersistGate} from 'redux-persist/integration/react';
import {NavigationContainer} from '@react-navigation/native';
import {store, persistor} from '@/app/store';
import {AppNavigator} from './src/navigation';
import {useTheme} from './src/hooks';
import CustomSplashScreen from './src/shared/components/common/customSplashScreen/customSplash';
import './src/localization';
import outputs from './amplify_outputs.json';
import {Amplify} from 'aws-amplify';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '@/features/auth/context/AuthContext';
import {configureSocialProviders} from '@/features/auth/services/socialAuth';
import { ErrorBoundary } from '@/shared/components/common/ErrorBoundary';

Amplify.configure(outputs);

LogBox.ignoreLogs([
  'This method is deprecated (as well as all React Native Firebase namespaced API)',
]);

function App(): React.JSX.Element {
  const [isSplashVisible, setIsSplashVisible] = useState(true);

  useEffect(() => {
    configureSocialProviders();
  }, []);

  const handleSplashAnimationEnd = () => {
    setIsSplashVisible(false);
  };

  if (isSplashVisible) {
    return <CustomSplashScreen onAnimationEnd={handleSplashAnimationEnd} />;
  }

  return (
    <Provider store={store}>
      <PersistGate loading={<CustomSplashScreen onAnimationEnd={() => {}} />} persistor={persistor}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <AuthProvider>
              <NavigationContainer>
                <AppContent />
              </NavigationContainer>
            </AuthProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </PersistGate>
    </Provider>
  );
}

function AppContent(): React.JSX.Element {
  const {theme, isDark} = useTheme();

  return (
    <>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={theme.colors.background}
        />
        <ErrorBoundary>
          <AppNavigator />
        </ErrorBoundary>
    </>
  );
}

export default App;
