/* eslint-disable react-native/no-inline-styles */
/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */
import React, {useEffect, useState} from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {Provider} from 'react-redux';
import {NavigationContainer} from '@react-navigation/native';
import {store} from './src/store';
import {AppNavigator} from './src/navigation';
import {useTheme} from './src/hooks';
import CustomSplashScreen from './src/components/common/customSplashScreen/customSplash';
import './src/localization';
import outputs from './amplify_outputs.json';
import {Amplify} from 'aws-amplify';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '@/contexts/AuthContext';
import {configureSocialProviders} from '@/services/auth/socialAuth';

Amplify.configure(outputs);

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
        <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
              <AuthProvider>
        <NavigationContainer>
          <AppContent />
        </NavigationContainer>
         </AuthProvider>
      </SafeAreaProvider>
        </GestureHandlerRootView>
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
        <AppNavigator />
    </>
  );
}

export default App;
