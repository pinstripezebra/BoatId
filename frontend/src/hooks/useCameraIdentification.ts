import { useState } from 'react';
import { Alert } from 'react-native';
import { launchCameraFunction } from '../components/Camera';
import { BoatApiService, type BoatIdentificationResponse } from '../services';

export const useCameraIdentification = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<BoatIdentificationResponse | null>(null);

  const captureAndIdentify = async (
    requestedFields: string[] = ['make', 'model', 'description', 'boat_type']
  ) => {
    setIsProcessing(true);
    
    try {
      // Use your existing camera function
      const imageUri = await launchCameraFunction();
      if (!imageUri) throw new Error('No image captured');
      
      // Use your existing API service
      const result = await BoatApiService.identifyBoat(imageUri, requestedFields, true);
      
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