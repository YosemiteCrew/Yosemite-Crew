/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */
import React, { useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { store } from './src/store';
import { AppNavigator } from './src/navigation';
import { useTheme } from './src/hooks';
import CustomSplashScreen from './src/components/common/customSplashScreen/customSplash';
import './src/localization';
import outputs from "./amplify_outputs.json";
import { Amplify } from 'aws-amplify';

Amplify.configure(outputs);

function App(): React.JSX.Element {
  const [isSplashVisible, setIsSplashVisible] = useState(true);

  const handleSplashAnimationEnd = () => {
    setIsSplashVisible(false);
  };

  if (isSplashVisible) {
    return <CustomSplashScreen onAnimationEnd={handleSplashAnimationEnd} />;
  }

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <NavigationContainer>
          <AppContent />
        </NavigationContainer>
      </SafeAreaProvider>
    </Provider>
  );
}

function AppContent(): React.JSX.Element {
  const { theme, isDark } = useTheme();

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