import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { launchCamera, MediaType, ImagePickerResponse, PhotoQuality } from 'react-native-image-picker';

interface CameraProps {
  onImageCaptured?: (imageUri: string) => void;
}

// Export the function for direct use as well
export const launchCameraFunction = () => {
  const options = {
    mediaType: 'photo' as MediaType,
    quality: 0.8 as PhotoQuality,
    includeBase64: false,
  };

  return new Promise<string | null>((resolve) => {
    launchCamera(options, (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorMessage) {
        resolve(null);
        return;
      }
      
      if (response.assets && response.assets[0] && response.assets[0].uri) {
        resolve(response.assets[0].uri);
      } else {
        resolve(null);
      }
    });
  });
};

export default launchCameraFunction;