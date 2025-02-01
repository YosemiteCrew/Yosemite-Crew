import { AppRegistry } from 'react-native';
import App from './App'
import {name as appName} from '../app.json';
import './app/lib/i18n';

AppRegistry.registerComponent(appName, () => App);
