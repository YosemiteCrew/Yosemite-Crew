/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import './src/lib/i18n';
import 'react-native-get-random-values';

AppRegistry.registerComponent(appName, () => App);