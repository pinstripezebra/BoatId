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
  const [popularBoats, setPopularBoats] = useState<BoatCardData[]>([]);
  const [likedBoatIds, setLikedBoatIds] = useState<Set<string>>(new Set());

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

  const loadPopularBoats = useCallback(async () => {
    try {
      const data = await BoatApiService.getPopularBoats(5);
      const mapped: BoatCardData[] = data.results.map(item => ({
        id: item.id.toString(),
        name: item.model
          ? `${item.make || ''} ${item.model}`.trim()
          : item.make || 'Unknown Boat',
        make: item.make || undefined,
        type: item.boat_type || undefined,
        image: item.image_url ? { uri: item.image_url } : undefined,
      }));
      setPopularBoats(mapped);
    } catch (error) {
      console.error('Failed to load popular boats:', error);
    }
  }, []);

  const loadLikedBoatIds = useCallback(async () => {
    try {
      const data = await BoatApiService.getLikedBoatIds();
      setLikedBoatIds(new Set(data.liked_boat_ids.map(id => id.toString())));
    } catch (error) {
      console.error('Failed to load liked boat ids:', error);
    }
  }, []);

  const handleLikeToggle = useCallback(async (boatId: string) => {
    const numericId = parseInt(boatId, 10);
    const wasLiked = likedBoatIds.has(boatId);
    try {
      if (wasLiked) {
        await BoatApiService.unlikeBoat(numericId);
        setLikedBoatIds(prev => {
          const next = new Set(prev);
          next.delete(boatId);
          return next;
        });
      } else {
        await BoatApiService.likeBoat(numericId);
        setLikedBoatIds(prev => new Set(prev).add(boatId));
      }
      // Refresh popular boats since like counts changed
      loadPopularBoats();
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  }, [likedBoatIds, loadPopularBoats]);

  const isBoatLiked = useCallback((id: string) => likedBoatIds.has(id), [likedBoatIds]);

  useEffect(() => {
    if (isLoggedIn) {
      loadUserBoats();
      loadPopularBoats();
      loadLikedBoatIds();
    }
  }, [isLoggedIn, loadUserBoats, loadPopularBoats, loadLikedBoatIds]);

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
        <ProfileScreen />
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

          <HorizontalBoatList title="Popular Boats" boats={popularBoats} onBoatPress={setSelectedBoat} maxItems={5} isLiked={isBoatLiked} onLikeToggle={handleLikeToggle} />
          <HorizontalBoatList title="Boats Near You" boats={NEARBY_BOATS} onBoatPress={setSelectedBoat} isLiked={isBoatLiked} onLikeToggle={handleLikeToggle} />

          {userBoats.length > 0 && (
            <HorizontalBoatList title="Your Boats" boats={userBoats} onBoatPress={setSelectedBoat} isLiked={isBoatLiked} onLikeToggle={handleLikeToggle} />
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
        isLiked={selectedBoat ? likedBoatIds.has(selectedBoat.id) : false}
        onLikeToggle={handleLikeToggle}
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
