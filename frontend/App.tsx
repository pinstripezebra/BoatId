/**
 * BoatId Mobile App
 * A React Native application for boat identification
 *
 * @format
 */

import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  Alert,
  ActivityIndicator,
} from 'react-native';

// Import our custom components
import {WelcomeCard, FeatureItem, Button} from './src/components';
import {useCameraIdentification} from './src/hooks/useCameraIdentification';
import type {BoatIdentificationResponse} from './src/services';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const { captureAndIdentify, isProcessing, lastResult } = useCameraIdentification();
  const [identificationHistory, setIdentificationHistory] = useState<BoatIdentificationResponse[]>([]);

  const backgroundStyle = {
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f8f9fa',
    flex: 1,
  };

  const textStyle = {
    color: isDarkMode ? '#ffffff' : '#333333',
  };

  // Feature handlers
  const handleCameraPress = async () => {
    try {
      const result = await captureAndIdentify(['make', 'model', 'description', 'boat_type', 'year']);
      
      // Add to history
      setIdentificationHistory(prev => [result, ...prev]);
      
      // Show result to user
      if (result.is_boat) {
        const details = result.boat_details;
        const message = `
Boat Identified! 🚤

Make: ${details?.make || 'Unknown'}
Model: ${details?.model || 'Unknown'}
Type: ${details?.boat_type || 'Unknown'}
Year: ${details?.year || 'Unknown'}
Confidence: ${result.confidence || 'Unknown'}

${details?.description || ''}`;
        
        Alert.alert('Success!', message.trim());
      } else {
        Alert.alert(
          'No Boat Detected',
          result.message || 'The image does not appear to contain a boat.'
        );
      }
    } catch (error) {
      console.error('Camera identification failed:', error);
      // Error already handled in the hook with Alert
    }
  };

  const handleIdentificationPress = () => {
    if (identificationHistory.length === 0) {
      Alert.alert('No History', 'No boat identifications yet. Use the camera to identify a boat!');
      return;
    }
    
    const lastIdentification = identificationHistory[0];
    if (lastIdentification.is_boat) {
      const details = lastIdentification.boat_details;
      const message = `
Last Identification:

Make: ${details?.make || 'Unknown'}
Model: ${details?.model || 'Unknown'}
Type: ${details?.boat_type || 'Unknown'}
Description: ${details?.description || 'No description'}
Confidence: ${lastIdentification.confidence || 'Unknown'}
ID: ${lastIdentification.identification_id || 'Not stored'}`;
      
      Alert.alert('Last Result', message.trim());
    } else {
      Alert.alert('Last Result', 'Previous image was not identified as a boat.');
    }
  };

  const handleStoragePress = () => {
    const totalIdentifications = identificationHistory.length;
    const boatIdentifications = identificationHistory.filter(r => r.is_boat).length;
    
    Alert.alert(
      'Storage Info', 
      `Total identifications: ${totalIdentifications}
Boats found: ${boatIdentifications}
Non-boats: ${totalIdentifications - boatIdentifications}`
    );
  };

  const handleAuthPress = () => {
    Alert.alert('Authentication', 'User login system coming soon!');
  };

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={backgroundStyle}
        contentContainerStyle={styles.scrollContainer}>
        
        <View style={styles.headerContainer}>
          <Text style={[styles.title, textStyle]}>⚓ BoatId</Text>
          <Text style={[styles.subtitle, textStyle]}>
            Boat Identification Made Simple
          </Text>
        </View>

        <View style={styles.contentContainer}>
          <WelcomeCard
            title="Welcome to BoatId! 🚤"
            description="Your go-to app for identifying and cataloging boats. Take photos, identify vessels, and build your maritime database."
          />

          {isProcessing && (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={[styles.processingText, textStyle]}>
                Analyzing boat image...
              </Text>
            </View>
          )}

          <View style={styles.featuresContainer}>
            <Text style={[styles.featuresTitle, textStyle]}>
              Features:
            </Text>
            
            <FeatureItem
              icon="📸"
              title={isProcessing ? "Processing..." : "Identify Boat"}
              onPress={handleCameraPress}
              disabled={isProcessing}
            />

            <FeatureItem
              icon="🔍"
              title={`View Results (${identificationHistory.length})`}
              onPress={handleIdentificationPress}
              disabled={identificationHistory.length === 0}
            />

            <FeatureItem
              icon="💾"
              title="Storage Stats"
              onPress={handleStoragePress}
            />

            <FeatureItem
              icon="👤"
              title="User Authentication"
              onPress={handleAuthPress}
            />
          </View>

          <View style={styles.buttonContainer}>
            <Button
              title={isProcessing ? "Processing..." : "Capture & Identify Boat"}
              onPress={handleCameraPress}
              variant="primary"
              disabled={isProcessing}
            />
            {identificationHistory.length > 0 && (
              <Button
                title="View Last Result"
                onPress={handleIdentificationPress}
                variant="secondary"
              />
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  contentContainer: {
    flex: 1,
  },
  featuresContainer: {
    marginBottom: 40,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  buttonContainer: {
    marginTop: 20,
  },
  processingContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 8,
    marginBottom: 20,
  },
  processingText: {
    marginTop: 10,
    fontSize: 16,
  },
});

export default App;
