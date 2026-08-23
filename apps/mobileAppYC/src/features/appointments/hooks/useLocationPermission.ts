import {useCallback, useReducer, useEffect} from 'react';
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
  /**
   * A geolocation lookup was attempted and failed (timeout, provider
   * unavailable, GPS off). Callers waiting for coordinates must stop waiting on
   * this and fall back, rather than treating "granted but no coordinates" as
   * "still loading" forever.
   */
  locationFailed: boolean;
  mapCenter: UserLocation | null;
  handleMapUserLocationChange: (location: UserLocation | null) => void;
}

const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 60000,
};

type LocationState = {
  userLocation: UserLocation | null;
  hasPermission: boolean;
  isLoading: boolean;
  /**
   * A geolocation lookup was attempted and failed.
   *
   * Distinct from "no location yet": permission granted with no coordinates
   * used to mean both, so callers waiting for coordinates waited forever after
   * a GPS timeout or an unavailable provider - and never fell back to searching
   * without a location.
   */
  locationFailed: boolean;
};

type LocationAction =
  | {type: 'PERMISSION_GRANTED'}
  | {type: 'GRANTED'; location: UserLocation}
  | {type: 'DENIED'}
  | {type: 'ERROR'}
  | {type: 'LOCATION_ERROR'}
  | {type: 'LOADING'};

const initialState: LocationState = {
  userLocation: null,
  hasPermission: false,
  isLoading: true,
  locationFailed: false,
};

function locationReducer(
  state: LocationState,
  action: LocationAction,
): LocationState {
  switch (action.type) {
    case 'PERMISSION_GRANTED':
      // A fresh attempt is starting, so any previous failure is cleared.
      return {
        ...state,
        hasPermission: true,
        isLoading: true,
        locationFailed: false,
      };
    case 'GRANTED':
      return {
        userLocation: action.location,
        hasPermission: true,
        isLoading: false,
        locationFailed: false,
      };
    case 'LOCATION_ERROR':
      return {
        ...state,
        userLocation: null,
        isLoading: false,
        locationFailed: true,
      };
    case 'DENIED':
    case 'ERROR':
      return {
        userLocation: null,
        hasPermission: false,
        isLoading: false,
        locationFailed: false,
      };
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
        dispatch({type: 'PERMISSION_GRANTED'});
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
            dispatch({type: 'LOCATION_ERROR'});
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

  const handleMapUserLocationChange = useCallback(
    (location: UserLocation | null) => {
      if (
        location == null ||
        !Number.isFinite(location.latitude) ||
        !Number.isFinite(location.longitude)
      ) {
        return;
      }
      dispatch({type: 'GRANTED', location});
    },
    [],
  );

  const mapCenter = state.userLocation ?? null;
  const userCoords: UserCoords | null = mapCenter
    ? {lat: mapCenter.latitude, lng: mapCenter.longitude}
    : null;

  return {
    userLocation: state.userLocation,
    userCoords,
    hasPermission: state.hasPermission,
    isLoading: state.isLoading,
    locationFailed: state.locationFailed,
    mapCenter,
    handleMapUserLocationChange,
  };
};
