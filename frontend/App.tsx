/**
 * BoatId Mobile App
 * A React Native application for boat identification
 *
 * @format
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AppState,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
  Alert,
  ActivityIndicator,
} from 'react-native';

import LoginScreen from './src/components/LoginScreen';
import PreviousResultsModal from './src/components/PreviousResultsModal';
import BoatDetailModal from './src/components/BoatDetailModal';
import type { DetailBoatData } from './src/components/BoatDetailModal';
import SearchBar from './src/components/SearchBar';
import HorizontalBoatList from './src/components/HorizontalBoatList';
import BottomNavBar from './src/components/BottomNavBar';
import type { TabName } from './src/components/BottomNavBar';
import ProfileScreen from './src/components/ProfileScreen';
import MapScreen from './src/components/MapScreen';
import {useCameraIdentification} from './src/hooks/useCameraIdentification';
import { AuthService } from './src/services/authService';
import { BoatApiService } from './src/services';
import type { BoatCardData } from './src/components/BoatCard';

const boatImages = {
  boat1: require('./src/assets/images/boat1.png'),
  boat2: require('./src/assets/images/boat2.png'),
  boat3: require('./src/assets/images/boat3.png'),
  boat4: require('./src/assets/images/boat4.png'),
  boat5: require('./src/assets/images/boat5.png'),
};

const POPULAR_BOATS: BoatCardData[] = [
  {id: 'p1', name: 'Sea Ray Sundancer', make: 'Sea Ray', type: 'Cruiser', image: boatImages.boat1},
  {id: 'p2', name: 'Boston Whaler Montauk', make: 'Boston Whaler', type: 'Center Console', image: boatImages.boat2},
  {id: 'p3', name: 'Bayliner VR5', make: 'Bayliner', type: 'Bowrider', image: boatImages.boat3},
  {id: 'p4', name: 'Yamaha 252S', make: 'Yamaha', type: 'Jet Boat', image: boatImages.boat4},
  {id: 'p5', name: 'Mastercraft X24', make: 'Mastercraft', type: 'Wakeboard', image: boatImages.boat5},
  {id: 'p6', name: 'Grady-White Freedom', make: 'Grady-White', type: 'Dual Console', image: boatImages.boat1},
];

const NEARBY_BOATS: BoatCardData[] = [
  {id: 'n1', name: 'Chaparral 267 SSX', make: 'Chaparral', type: 'Bowrider', image: boatImages.boat3},
  {id: 'n2', name: 'Tracker Pro 170', make: 'Tracker', type: 'Bass Boat', image: boatImages.boat5},
  {id: 'n3', name: 'Cobalt R8', make: 'Cobalt', type: 'Bowrider', image: boatImages.boat2},
  {id: 'n4', name: 'Ranger Z520L', make: 'Ranger', type: 'Bass Boat', image: boatImages.boat4},
  {id: 'n5', name: 'Malibu Wakesetter', make: 'Malibu', type: 'Wakeboard', image: boatImages.boat1},
];

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const { captureAndIdentify, isProcessing } = useCameraIdentification();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showPreviousResults, setShowPreviousResults] = useState(false);
  const [selectedBoat, setSelectedBoat] = useState<DetailBoatData | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>('home');
  const [userBoats, setUserBoats] = useState<BoatCardData[]>([]);

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

  // Proactively refresh the access token when the app returns from background
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active' && isLoggedIn) {
        AuthService.refresh().catch(() => {
          // Refresh failed — token may be revoked; force re-login
          setIsLoggedIn(false);
        });
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, [isLoggedIn]);

  // Fetch user's boats when logged in
  const loadUserBoats = useCallback(async () => {
    try {
      const data = await BoatApiService.getIdentifications(1, 10, { isBoat: true });
      const mapped: BoatCardData[] = data.results.map(item => ({
        id: item.id.toString(),
        name: item.identification_data?.model
          ? `${item.identification_data.make || ''} ${item.identification_data.model}`.trim()
          : item.identification_data?.make || 'Unknown Boat',
        make: item.identification_data?.make,
        type: item.identification_data?.boat_type,
        image: item.image_url ? { uri: item.image_url } : undefined,
      }));
      setUserBoats(mapped);
    } catch (error) {
      console.error('Failed to load user boats:', error);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      loadUserBoats();
    }
  }, [isLoggedIn, loadUserBoats]);

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

      {activeTab === 'profile' ? (
        <ProfileScreen onViewAllBoats={() => setShowPreviousResults(true)} />
      ) : activeTab === 'map' ? (
        <MapScreen onBoatPress={setSelectedBoat} />
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={backgroundStyle}
          contentContainerStyle={styles.scrollContainer}>
          
          <View style={styles.headerContainer}>
            <View style={styles.headerRow}>
              <View style={styles.headerTextGroup}>
                <Text style={[styles.title, textStyle]}>⚓ BoatId</Text>
                <Text style={[styles.subtitle, textStyle]}>
                  Boat Identification Made Simple
                </Text>
              </View>
              <TouchableOpacity onPress={handleLogout} style={styles.signOutButton}>
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
            {user && (
              <Text style={[styles.userLabel, textStyle]}>
                Signed in as {user.username}
              </Text>
            )}
          </View>

          <SearchBar />

          <HorizontalBoatList title="Popular Boats" boats={POPULAR_BOATS} onBoatPress={setSelectedBoat} />
          <HorizontalBoatList title="Boats Near You" boats={NEARBY_BOATS} onBoatPress={setSelectedBoat} />

          {userBoats.length > 0 && (
            <HorizontalBoatList title="Your Boats" boats={userBoats} onBoatPress={setSelectedBoat} />
          )}
        </ScrollView>
      )}

      <BottomNavBar
        onCameraPress={handleCameraPress}
        isProcessing={isProcessing}
        activeTab={activeTab}
        onHomePress={() => setActiveTab('home')}
        onMapPress={() => setActiveTab('map')}
        onProfilePress={() => setActiveTab('profile')}
      />

      <PreviousResultsModal
        visible={showPreviousResults}
        onClose={() => setShowPreviousResults(false)}
      />

      <BoatDetailModal
        visible={selectedBoat !== null}
        boat={selectedBoat}
        onClose={() => setSelectedBoat(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerContainer: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTextGroup: {
    flex: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  userLabel: {
    marginTop: 6,
    fontSize: 13,
    opacity: 0.6,
  },
  signOutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    marginTop: 4,
  },
  signOutText: {
    color: '#f44336',
    fontSize: 13,
    fontWeight: '500',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
