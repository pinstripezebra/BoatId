import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { CarApiService } from '../services';
import type { NearbyCar } from '../services';
import type { DetailCarData } from './CarDetailModal';

interface MapScreenProps {
  onCarPress: (car: DetailCarData) => void;
}

const DEFAULT_REGION: Region = {
  latitude: 25.76,
  longitude: -80.19,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

const MapScreen: React.FC<MapScreenProps> = ({ onCarPress }) => {
  const isDarkMode = useColorScheme() === 'dark';
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [cars, setCars] = useState<NearbyCar[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const regionToRadiusKm = (r: Region): number => {
    // Approximate visible radius from latitude delta
    return Math.max((r.latitudeDelta * 111) / 2, 1);
  };

  const fetchNearbyCars = useCallback(async (r: Region) => {
    setLoading(true);
    try {
      const radiusKm = regionToRadiusKm(r);
      const data = await CarApiService.getNearbyCars(r.latitude, r.longitude, radiusKm);
      setCars(data.results);
    } catch (error) {
      console.error('Failed to fetch nearby cars:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get user location and center map on mount
  useEffect(() => {
    const getLocation = async () => {
      try {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            setInitialLoad(false);
            fetchNearbyCars(DEFAULT_REGION);
            return;
          }
        }
        Geolocation.getCurrentPosition(
          (position) => {
            const userRegion: Region = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              latitudeDelta: 0.5,
              longitudeDelta: 0.5,
            };
            setRegion(userRegion);
            setInitialLoad(false);
            fetchNearbyCars(userRegion);
          },
          () => {
            setInitialLoad(false);
            fetchNearbyCars(DEFAULT_REGION);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
      } catch {
        setInitialLoad(false);
        fetchNearbyCars(DEFAULT_REGION);
      }
    };
    getLocation();
  }, [fetchNearbyCars]);

  const handleRefresh = () => {
    fetchNearbyCars(region);
  };

  const handleRegionChangeComplete = (newRegion: Region) => {
    setRegion(newRegion);
  };

  const handleMarkerPress = (car: NearbyCar) => {
    const detailData: DetailCarData = {
      id: car.id.toString(),
      name: car.model
        ? `${car.make || ''} ${car.model}`.trim()
        : car.make || 'Unknown Car',
      make: car.make || undefined,
      type: car.car_type || undefined,
      model: car.model || undefined,
      image: car.image_url ? { uri: car.image_url } : undefined,
    };
    onCarPress(detailData);
  };

  if (initialLoad) {
    return (
      <View style={[styles.centered, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f8f9fa' }]}>
        <ActivityIndicator size="large" color="#2196f3" />
        <Text style={{ color: isDarkMode ? '#fff' : '#333', marginTop: 12 }}>
          Getting your location...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {cars.map((car) => (
          <Marker
            key={car.id}
            coordinate={{ latitude: car.latitude, longitude: car.longitude }}
            title={car.make || 'Car'}
            description={car.car_type || undefined}
            onPress={() => handleMarkerPress(car)}
          />
        ))}
      </MapView>

      <TouchableOpacity
        style={[styles.refreshButton, loading && styles.refreshButtonDisabled]}
        onPress={loading ? undefined : handleRefresh}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={styles.refreshText}>🔄 Refresh</Text>
        )}
      </TouchableOpacity>

      <View style={styles.countBadge}>
        <Text style={styles.countText}>
          {cars.length} car{cars.length !== 1 ? 's' : ''} nearby
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#2196f3',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  refreshButtonDisabled: {
    backgroundColor: '#90CAF9',
  },
  refreshText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  countBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  countText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default MapScreen;
