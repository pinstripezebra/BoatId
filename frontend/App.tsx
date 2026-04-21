/**
 * CarId Mobile App
 * A React Native application for car identification
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
import VerificationScreen from './src/components/VerificationScreen';
import ForgotPasswordScreen from './src/components/ForgotPasswordScreen';
import ResetPasswordScreen from './src/components/ResetPasswordScreen';
import PreviousResultsModal from './src/components/PreviousResultsModal';
import CarDetailModal from './src/components/CarDetailModal';
import type { DetailCarData } from './src/components/CarDetailModal';
import SearchBar from './src/components/SearchBar';
import HorizontalCarList from './src/components/HorizontalCarList';
import BottomNavBar from './src/components/BottomNavBar';
import type { TabName } from './src/components/BottomNavBar';
import ProfileScreen from './src/components/ProfileScreen';
import MapScreen from './src/components/MapScreen';
import SearchResultsScreen from './src/components/SearchResultsScreen';
import AboutUsScreen from './src/components/AboutUsScreen';
import PrivacyPolicyScreen from './src/components/PrivacyPolicyScreen';
import {useCameraIdentification} from './src/hooks/useCameraIdentification';
import { AuthService } from './src/services/authService';
import { CarApiService } from './src/services';
import { getCachedOrFetch } from './src/utils/queryCache';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const { captureAndIdentify, isProcessing } = useCameraIdentification();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [resetFlowEmail, setResetFlowEmail] = useState<string | null>(null);
  const [resetFlowStep, setResetFlowStep] = useState<'forgot' | 'reset' | null>(null);
  const [showPreviousResults, setShowPreviousResults] = useState(false);
  const [selectedCar, setSelectedCar] = useState<DetailCarData | null>(null);
  const [identificationResult, setIdentificationResult] = useState<{car: DetailCarData; identificationId: number} | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>('home');
  const [userCars, setUserCars] = useState<DetailCarData[]>([]);
  const [popularCars, setPopularCars] = useState<DetailCarData[]>([]);
  const [nearbyCars, setNearbyCars] = useState<DetailCarData[]>([]);
  const [likedCarIds, setLikedCarIds] = useState<Set<string>>(new Set());
  const [showAboutUs, setShowAboutUs] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

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

  // Fetch user's cars when logged in
  const loadUserCars = useCallback(async () => {
    try {
      const data = await CarApiService.getIdentifications(1, 10, { isCar: true });
      const mapped: DetailCarData[] = data.results.map(item => ({
        id: item.id.toString(),
        name: item.identification_data?.model
          ? `${item.identification_data.make || ''} ${item.identification_data.model}`.trim()
          : item.identification_data?.make || 'Unknown Car',
        make: item.identification_data?.make,
        model: item.identification_data?.model,
        type: item.identification_data?.car_type,
        year: item.identification_data?.year,
        confidence: item.identification_data?.confidence as string | undefined,
        image: item.image_url ? { uri: item.image_url } : undefined,
        identification_data: item.identification_data,
      }));
      setUserCars(mapped);
    } catch (error) {
      console.error('Failed to load user cars:', error);
    }
  }, []);

  const loadPopularCars = useCallback(async () => {
    try {
      const data = await CarApiService.getPopularCars(5);
      const mapped: DetailCarData[] = data.results.map(item => ({
        id: item.id.toString(),
        name: item.model
          ? `${item.make || ''} ${item.model}`.trim()
          : item.make || 'Unknown Car',
        make: item.make || undefined,
        model: item.model || undefined,
        type: item.car_type || undefined,
        year: item.year_estimate || undefined,
        confidence: item.confidence || undefined,
        image: item.image_url ? { uri: item.image_url } : undefined,
        identification_data: item.identification_data,
      }));
      setPopularCars(mapped);
    } catch (error) {
      console.error('Failed to load popular cars:', error);
    }
  }, []);

  const loadNearbyCars = useCallback(async () => {
    try {
      // Use a broad radius from a central US location to get varied results
      const data = await CarApiService.getNearbyCars(39.8, -98.6, 5000);
      const mapped: DetailCarData[] = data.results.slice(0, 5).map(item => ({
        id: item.id.toString(),
        name: item.model
          ? `${item.make || ''} ${item.model}`.trim()
          : item.make || 'Unknown Car',
        make: item.make || undefined,
        model: item.model || undefined,
        type: item.car_type || undefined,
        year: item.year_estimate || undefined,
        confidence: item.confidence || undefined,
        image: item.image_url ? { uri: item.image_url } : undefined,
        identification_data: item.identification_data,
      }));
      setNearbyCars(mapped);
    } catch (error) {
      console.error('Failed to load nearby cars:', error);
    }
  }, []);

  const loadLikedCarIds = useCallback(async () => {
    try {
      const data = await CarApiService.getLikedCarIds();
      setLikedCarIds(new Set(data.liked_car_ids.map(id => id.toString())));
    } catch (error) {
      console.error('Failed to load liked car ids:', error);
    }
  }, []);

  const handleLikeToggle = useCallback(async (carId: string) => {
    const numericId = parseInt(carId, 10);
    const wasLiked = likedCarIds.has(carId);
    try {
      if (wasLiked) {
        await CarApiService.unlikeCar(numericId);
        setLikedCarIds(prev => {
          const next = new Set(prev);
          next.delete(carId);
          return next;
        });
      } else {
        await CarApiService.likeCar(numericId);
        setLikedCarIds(prev => new Set(prev).add(carId));
      }
      // Refresh popular cars since like counts changed
      loadPopularCars();
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  }, [likedCarIds, loadPopularCars]);

  const isCarLiked = useCallback((id: string) => likedCarIds.has(id), [likedCarIds]);

  // Prefetch and cache after login
  useEffect(() => {
    if (isLoggedIn) {
      loadUserCars();
      loadPopularCars();
      loadNearbyCars();
      loadLikedCarIds();

      // Prefetch and cache popular, nearby, and history
      getCachedOrFetch(
        'popularCars',
        () => CarApiService.getPopularCars(5),
        { ttl: 5 * 60 * 1000 }
      );
      getCachedOrFetch(
        'nearbyCars',
        () => CarApiService.getNearbyCars(39.8, -98.6, 5000),
        { ttl: 5 * 60 * 1000 }
      );
      getCachedOrFetch(
        'userHistory',
        () => CarApiService.getIdentifications(1, 10, { isCar: true }),
        { ttl: 60 * 1000 }
      );
    }
  }, [isLoggedIn, loadUserCars, loadPopularCars, loadLikedCarIds]);

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
    if (pendingVerificationEmail) {
      return (
        <VerificationScreen
          email={pendingVerificationEmail}
          onVerified={() => {
            setPendingVerificationEmail(null);
            setIsLoggedIn(true);
          }}
          onBack={() => setPendingVerificationEmail(null)}
        />
      );
    }

    if (resetFlowStep === 'forgot') {
      return (
        <ForgotPasswordScreen
          onCodeSent={(email) => {
            setResetFlowEmail(email);
            setResetFlowStep('reset');
          }}
          onBack={() => {
            setResetFlowStep(null);
            setResetFlowEmail(null);
          }}
        />
      );
    }

    if (resetFlowStep === 'reset' && resetFlowEmail) {
      return (
        <ResetPasswordScreen
          email={resetFlowEmail}
          onResetSuccess={() => {
            setResetFlowStep(null);
            setResetFlowEmail(null);
          }}
          onBack={() => {
            setResetFlowStep(null);
            setResetFlowEmail(null);
          }}
        />
      );
    }

    return (
      <LoginScreen
        onLoginSuccess={() => setIsLoggedIn(true)}
        onNeedsVerification={(email) => setPendingVerificationEmail(email)}
        onForgotPassword={() => setResetFlowStep('forgot')}
      />
    );
  }

  const user = AuthService.getUser();

  // Feature handlers
  const handleCameraPress = async () => {
    try {
      const result = await captureAndIdentify(['make', 'model', 'description', 'car_type', 'year', 'body_type', 'features']);
      
      if (result.is_car && result.car_details) {
        const details = result.car_details;
        const carData: DetailCarData = {
          id: result.identification_id?.toString() || '0',
          name: details.model
            ? `${details.make || ''} ${details.model}`.trim()
            : details.make || 'Unknown Car',
          make: details.make,
          model: details.model,
          type: details.car_type,
          year: details.year,
          confidence: result.confidence,
          identification_data: details,
        };
        setIdentificationResult({
          car: carData,
          identificationId: result.identification_id || 0,
        });
      } else {
        Alert.alert(
          'No Car Detected',
          result.message || 'The image does not appear to contain a car.'
        );
      }
    } catch (error) {
      console.error('Camera identification failed:', error);
    }
  };

  const handleIdentificationModalClose = async (editedFields?: Partial<import('./src/services/carApi').CarDetails>) => {
    if (editedFields && identificationResult?.identificationId) {
      try {
        await CarApiService.updateIdentification(identificationResult.identificationId, editedFields);
      } catch (error) {
        console.error('Failed to save edits:', error);
      }
    }
    setIdentificationResult(null);
    loadUserCars();
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

      {showAboutUs ? (
        <AboutUsScreen onClose={() => setShowAboutUs(false)} />
      ) : showPrivacyPolicy ? (
        <PrivacyPolicyScreen onClose={() => setShowPrivacyPolicy(false)} />
      ) : activeTab === 'profile' ? (
        <ProfileScreen
          onLogout={handleLogout}
          onCarPress={(car) => setSelectedCar(car)}
          onShowAboutUs={() => setShowAboutUs(true)}
        />
      ) : activeTab === 'map' ? (
        <MapScreen onCarPress={setSelectedCar} />
      ) : activeTab === 'search' ? (
        <SearchResultsScreen
          onBack={() => setActiveTab('home')}
          onCarPress={setSelectedCar}
          isLiked={isCarLiked}
          onLikeToggle={handleLikeToggle}
        />
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={backgroundStyle}
          contentContainerStyle={styles.scrollContainer}>
          
          <View style={styles.headerContainer}>
            <View style={styles.headerRow}>
              <View style={styles.headerTextGroup}>
                <Text style={[styles.title, textStyle]}>🚗 CarId</Text>
                <Text style={[styles.subtitle, textStyle]}>
                  Car Identification Made Simple
                </Text>
              </View>
            </View>
            {user && (
              <Text style={[styles.userLabel, textStyle]}>
                Signed in as {user.username}
              </Text>
            )}
          </View>

          <SearchBar onPress={() => setActiveTab('search')} />

          <HorizontalCarList title="Popular Cars" cars={popularCars} onCarPress={(car) => setSelectedCar(car as DetailCarData)} maxItems={5} isLiked={isCarLiked} onLikeToggle={handleLikeToggle} />
          <HorizontalCarList title="Cars Near You" cars={nearbyCars} onCarPress={(car) => setSelectedCar(car as DetailCarData)} isLiked={isCarLiked} onLikeToggle={handleLikeToggle} />

          {userCars.length > 0 && (
            <HorizontalCarList title="Your Cars" cars={userCars} onCarPress={(car) => setSelectedCar(car as DetailCarData)} isLiked={isCarLiked} onLikeToggle={handleLikeToggle} />
          )}

          <View style={styles.homeFooterLinksRow}>
            <TouchableOpacity onPress={() => setShowAboutUs(true)}>
              <Text style={styles.homeFooterLink}>About Us</Text>
            </TouchableOpacity>
            <Text style={[styles.homeFooterDivider, textStyle]}>|</Text>
            <TouchableOpacity onPress={() => setShowPrivacyPolicy(true)}>
              <Text style={styles.homeFooterLink}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {!showAboutUs && !showPrivacyPolicy && (
        <BottomNavBar
          onCameraPress={handleCameraPress}
          isProcessing={isProcessing}
          activeTab={activeTab}
          onHomePress={() => setActiveTab('home')}
          onMapPress={() => setActiveTab('map')}
          onProfilePress={() => setActiveTab('profile')}
        />
      )}

      <PreviousResultsModal
        visible={showPreviousResults}
        onClose={() => setShowPreviousResults(false)}
      />

      <CarDetailModal
        visible={selectedCar !== null}
        car={selectedCar}
        onClose={() => setSelectedCar(null)}
        isLiked={selectedCar ? likedCarIds.has(selectedCar.id) : false}
        onLikeToggle={handleLikeToggle}
      />

      <CarDetailModal
        visible={identificationResult !== null}
        car={identificationResult?.car ?? null}
        onClose={handleIdentificationModalClose}
        editable
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
  homeFooterLinksRow: {
    marginTop: 12,
    marginBottom: 6,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeFooterLink: {
    color: '#2196f3',
    textDecorationLine: 'underline',
    fontSize: 14,
    fontWeight: '600',
  },
  homeFooterDivider: {
    marginHorizontal: 10,
    opacity: 0.55,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
