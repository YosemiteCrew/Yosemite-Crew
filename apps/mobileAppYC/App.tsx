/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */
import { SvgUri } from 'react-native-svg';
import { NewAppScreen } from '@react-native/new-app-screen';
import {
  Image,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View>
        <Text>Harshit Wandhare</Text>
      </View>
            <View>
        
    <SvgUri
  width="100"
  height="100"
  uri="https://reactnative.dev/img/header_logo.svg"
/>
<Image
  source={{ uri: 'https://picsum.photos/200/200' }}
  style={{ width: 100, height: 100 }}
  onLoad={() => console.log('Image loaded')}
  onError={(error) => console.log('Image error:', error)}
/>
<Image
  source={{ uri: 'https://reactnative.dev/img/tiny_logo.png' }}
  style={{ width: 100, height: 100 }}
/>
 <Image
          source={require('./assets/sample.jpg')} // Replace with your actual image name
          style={{ width: 100, height: 100 }}
          onLoad={() => console.log('Local image loaded')}
          onError={(error) => console.log('Local image error:', error)}
        />
      </View>
      <NewAppScreen
        templateFileName="App.tsx"
        safeAreaInsets={safeAreaInsets}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
