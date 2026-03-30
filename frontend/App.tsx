/**
 * BoatId Mobile App
 * A React Native application for boat identification
 *
 * @format
 */

import React, { useState, useEffect } from 'react';
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
import LoginScreen from './src/components/LoginScreen';
import PreviousResultsModal from './src/components/PreviousResultsModal';
import {useCameraIdentification} from './src/hooks/useCameraIdentification';
import { AuthService } from './src/services/authService';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const { captureAndIdentify, isProcessing } = useCameraIdentification();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showPreviousResults, setShowPreviousResults] = useState(false);

  const backgroundStyle = {
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f8f9fa',
    flex: 1,
  };

  const textStyle = {
    color: isDarkMode ? '#ffffff' : '#333333',
  };

  // Check for stored auth on app launch
  useEffect(() => {
    AuthService.loadStoredAuth().then(authenticated => {
      setIsLoggedIn(authenticated);
      setIsCheckingAuth(false);
    });
  }, []);

  // Show loading while checking stored auth
  if (isCheckingAuth) {
    return (
      <SafeAreaView style={[backgroundStyle, styles.centered]}>
        <ActivityIndicator size="large" color="#2196f3" />
      </SafeAreaView>
    );
  }

  // Show login screen if not authenticated
  if (!isLoggedIn) {
    return <LoginScreen onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  const user = AuthService.getUser();

  // Feature handlers
  const handleCameraPress = async () => {
    try {
      const result = await captureAndIdentify(['make', 'model', 'description', 'boat_type', 'year']);
      
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
    }
  };

  const handleLogout = async () => {
    await AuthService.logout();
    setIsLoggedIn(false);
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
          {user && (
            <Text style={[styles.userLabel, textStyle]}>
              Signed in as {user.username}
            </Text>
          )}
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
              icon="📋"
              title="Previous Results"
              onPress={() => setShowPreviousResults(true)}
            />

            <FeatureItem
              icon="🚪"
              title="Sign Out"
              onPress={handleLogout}
            />
          </View>

          <View style={styles.buttonContainer}>
            <Button
              title={isProcessing ? "Processing..." : "Capture & Identify Boat"}
              onPress={handleCameraPress}
              variant="primary"
              disabled={isProcessing}
            />
            <Button
              title="Previous Results"
              onPress={() => setShowPreviousResults(true)}
              variant="secondary"
            />
          </View>
        </View>
      </ScrollView>

      <PreviousResultsModal
        visible={showPreviousResults}
        onClose={() => setShowPreviousResults(false)}
      />
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
  userLabel: {
    marginTop: 8,
    fontSize: 14,
    opacity: 0.6,
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
