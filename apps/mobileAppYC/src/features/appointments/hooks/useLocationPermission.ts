import {useReducer, useEffect} from 'react';
import {Platform, PermissionsAndroid, AppState} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import i18n from '@/localization';

export interface UserLocation {
  latitude: number;
  longitude: number;
}

export interface UserCoords {
  lat: number;
  lng: number;
}

export interface LocationPermissionState {
  userLocation: UserLocation | null;
  userCoords: UserCoords | null;
  hasPermission: boolean;
  isLoading: boolean;
  mapCenter: UserLocation | null;
}
const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: Platform.OS === 'android',
  timeout: Platform.OS === 'android' ? 20000 : 10000,
  maximumAge: 0,
};

type LocationState = {
  userLocation: UserLocation | null;
  hasPermission: boolean;
  isLoading: boolean;
};

type LocationAction =
  | {type: 'GRANTED'; location: UserLocation}
  | {type: 'DENIED'}
  | {type: 'ERROR'}
  | {type: 'LOADING'};

const initialState: LocationState = {
  userLocation: null,
  hasPermission: false,
  isLoading: true,
};

function locationReducer(
  state: LocationState,
  action: LocationAction,
): LocationState {
  switch (action.type) {
    case 'GRANTED':
      return {
        userLocation: action.location,
        hasPermission: true,
        isLoading: false,
      };
    case 'DENIED':
    case 'ERROR':
      return {userLocation: null, hasPermission: false, isLoading: false};
    case 'LOADING':
      return {...state, isLoading: true};
    default:
      return state;
  }
}

const requestAndroidPermission = async (): Promise<boolean> => {
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: i18n.t('mapDiscovery.locationPermissionTitle'),
      message: i18n.t('mapDiscovery.locationPermissionMessage'),
      buttonPositive: i18n.t('mapDiscovery.locationPermissionAllow'),
      buttonNegative: i18n.t('mapDiscovery.locationPermissionDeny'),
    },
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
};

const resolveIosPermission = (): Promise<void> =>
  new Promise(resolve => {
    Geolocation.requestAuthorization();
    resolve();
  });

const requestPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    return requestAndroidPermission();
  }
  await resolveIosPermission();
  return true;
};

export const useLocationPermission = (): LocationPermissionState => {
  const [state, dispatch] = useReducer(locationReducer, initialState);

  useEffect(() => {
    let cancelled = false;

    const fetchLocation = async () => {
      dispatch({type: 'LOADING'});
      try {
        const granted = await requestPermission();
        if (cancelled) return;
        if (!granted) {
          dispatch({type: 'DENIED'});
          return;
        }
        Geolocation.getCurrentPosition(
          position => {
            if (cancelled) return;
            dispatch({
              type: 'GRANTED',
              location: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              },
            });
          },
          () => {
            if (cancelled) return;
            dispatch({type: 'ERROR'});
          },
          GEOLOCATION_OPTIONS,
        );
      } catch {
        if (!cancelled) {
          dispatch({type: 'ERROR'});
        }
      }
    };

    fetchLocation();

    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        fetchLocation();
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const mapCenter = state.userLocation ?? null;
  const userCoords: UserCoords | null = mapCenter
    ? {lat: mapCenter.latitude, lng: mapCenter.longitude}
    : null;

  return {
    userLocation: state.userLocation,
    userCoords,
    hasPermission: state.hasPermission,
    isLoading: state.isLoading,
    mapCenter,
  };
};
