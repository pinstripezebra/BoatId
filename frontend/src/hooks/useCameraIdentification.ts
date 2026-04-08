import { useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { launchCameraFunction } from '../components/Camera';
import { BoatApiService, type BoatIdentificationResponse } from '../services';

const getCurrentPosition = (): Promise<{latitude: number; longitude: number} | null> => {
  return new Promise(async (resolve) => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          resolve(null);
          return;
        }
      }
      Geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    } catch {
      resolve(null);
    }
  });
};

export const useCameraIdentification = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<BoatIdentificationResponse | null>(null);

  const captureAndIdentify = async (
    requestedFields: string[] = ['make', 'model', 'description', 'boat_type']
  ) => {
    setIsProcessing(true);
    
    try {
      // Get location while user is taking photo
      const locationPromise = getCurrentPosition();
      
      // Use your existing camera function
      const imageUri = await launchCameraFunction();
      if (!imageUri) throw new Error('No image captured');
      
      const location = await locationPromise;
      
      // Use your existing API service
      const result = await BoatApiService.identifyBoat(
        imageUri,
        requestedFields,
        true,
        location?.latitude,
        location?.longitude
      );
      
      setLastResult(result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to identify boat: ${message}`);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  return { captureAndIdentify, isProcessing, lastResult };
};