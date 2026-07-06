import Geolocation from '@react-native-community/geolocation';
import {Platform, Alert} from 'react-native';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';

interface LocationCoords {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
}

class LocationService {
  private watchId: number | null = null;

  async checkLocationPermission(): Promise<boolean> {
    const permission =
      Platform.OS === 'ios'
        ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
        : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

    const result = await check(permission);
    return result === RESULTS.GRANTED;
  }

  async requestLocationPermission(): Promise<boolean> {
    const permission =
      Platform.OS === 'ios'
        ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
        : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

    const result = await request(permission);

    if (result === RESULTS.BLOCKED) {
      Alert.alert(
        'Location Permission Required',
        'Please enable location access in your device settings to use this feature.',
        [{text: 'OK'}],
      );
      return false;
    }

    return result === RESULTS.GRANTED;
  }

  async getCurrentPosition(): Promise<LocationCoords> {
    const hasPermission = await this.checkLocationPermission();

    if (!hasPermission) {
      const granted = await this.requestLocationPermission();
      if (!granted) {
        throw new Error('Location permission denied');
      }
    }

    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position => {
          resolve(position.coords);
        },
        error => {
          const normalizedError =
            error instanceof Error
              ? error
              : new Error(error?.message ?? 'Unable to retrieve location');
          console.error('Location error:', normalizedError);
          reject(normalizedError);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        },
      );
    });
  }

  watchPosition(
    onSuccess: (coords: LocationCoords) => void,
    onError?: (error: any) => void,
  ): void {
    this.watchId = Geolocation.watchPosition(
      position => {
        onSuccess(position.coords);
      },
      error => {
        const normalizedError =
          error instanceof Error
            ? error
            : new Error(error?.message ?? 'Unable to watch location');
        console.error('Watch position error:', normalizedError);
        onError?.(normalizedError);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 10, // Meters
        interval: 10000, // Android only
        fastestInterval: 5000, // Android only
      },
    );
  }

  stopWatching(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  // Helper to get location with retry logic
  async getLocationWithRetry(maxRetries = 3): Promise<LocationCoords | null> {
    if (maxRetries <= 0) {
      return null;
    }

    const attemptLocation = async (
      retries: number,
    ): Promise<LocationCoords | null> => {
      try {
        const coords = await this.getCurrentPosition();
        return coords;
      } catch (error) {
        const nextRetries = retries + 1;
        const normalizedError =
          error instanceof Error ? error : new Error(String(error));
        console.log(`Location attempt ${nextRetries} failed:`, normalizedError);

        if (nextRetries === maxRetries) {
          Alert.alert(
            'Location Error',
            'Unable to get your location. Please check your GPS settings.',
            [{text: 'OK'}],
          );
          return null;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        return attemptLocation(nextRetries);
      }
    };

    return attemptLocation(0);
  }
}

export default new LocationService();
