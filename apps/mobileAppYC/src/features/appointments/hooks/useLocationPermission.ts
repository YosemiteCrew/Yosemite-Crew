import {useState, useEffect} from 'react';
import {Platform, PermissionsAndroid} from 'react-native';
import Geolocation from '@react-native-community/geolocation';

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
  userCoords: UserCoords;
  hasPermission: boolean;
  isLoading: boolean;
  mapCenter: UserLocation;
}

const DEFAULT_CENTER: UserLocation = {latitude: 37.7749, longitude: -122.4194};
const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 60000,
};

const requestAndroidPermission = async (): Promise<boolean> => {
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'Location Access',
      message: 'Allow Yosemite Crew to show clinics near you.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
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
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchLocation = async () => {
      try {
        const granted = await requestPermission();
        if (!granted) {
          if (!cancelled) {
            setHasPermission(false);
            setIsLoading(false);
          }
          return;
        }

        Geolocation.getCurrentPosition(
          position => {
            if (cancelled) return;
            setUserLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
            setHasPermission(true);
            setIsLoading(false);
          },
          () => {
            if (cancelled) return;
            setHasPermission(false);
            setIsLoading(false);
          },
          GEOLOCATION_OPTIONS,
        );
      } catch {
        if (!cancelled) {
          setHasPermission(false);
          setIsLoading(false);
        }
      }
    };

    fetchLocation();
    return () => {
      cancelled = true;
    };
  }, []);

  const mapCenter = userLocation ?? DEFAULT_CENTER;
  const userCoords: UserCoords = {
    lat: mapCenter.latitude,
    lng: mapCenter.longitude,
  };

  return {userLocation, userCoords, hasPermission, isLoading, mapCenter};
};
