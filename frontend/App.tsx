/**
 * BoatId Mobile App
 * A React Native application for boat identification
 *
 * @format
 */

import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  Alert,
} from 'react-native';

// Import our custom components
import {WelcomeCard, FeatureItem, Button} from './src/components';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  const backgroundStyle = {
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f8f9fa',
    flex: 1,
  };

  const textStyle = {
    color: isDarkMode ? '#ffffff' : '#333333',
  };

  // Feature handlers
  const handleCameraPress = () => {
    Alert.alert('Camera Feature', 'Camera integration coming soon!');
  };

  const handleIdentificationPress = () => {
    Alert.alert('Boat Identification', 'AI boat identification coming soon!');
  };

  const handleStoragePress = () => {
    Alert.alert('Data Storage', 'Cloud storage integration coming soon!');
  };

  const handleAuthPress = () => {
    Alert.alert('Authentication', 'User login system coming soon!');
  };

  const handleGetStarted = () => {
    Alert.alert(
      'Welcome to BoatId!',
      'Ready to start building your boat identification app?',
      [
        {text: 'Yes, let\'s go!', style: 'default'},
        {text: 'Not yet', style: 'cancel'},
      ]
    );
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

          <View style={styles.featuresContainer}>
            <Text style={[styles.featuresTitle, textStyle]}>
              Coming Features:
            </Text>
            
            <FeatureItem
              icon="📸"
              title="Camera Integration"
              onPress={handleCameraPress}
            />

            <FeatureItem
              icon="🔍"
              title="Boat Identification"
              onPress={handleIdentificationPress}
            />

            <FeatureItem
              icon="💾"
              title="Data Storage"
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
              title="Get Started"
              onPress={handleGetStarted}
              variant="primary"
            />
            <Button
              title="Learn More"
              onPress={() => Alert.alert('Learn More', 'Visit our documentation!')}
              variant="secondary"
            />
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
});

export default App;
