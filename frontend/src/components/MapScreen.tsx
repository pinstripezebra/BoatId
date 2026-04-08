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
import { BoatApiService } from '../services';
import type { NearbyBoat } from '../services';
import type { DetailBoatData } from './BoatDetailModal';

interface MapScreenProps {
  onBoatPress: (boat: DetailBoatData) => void;
}

const DEFAULT_REGION: Region = {
  latitude: 25.76,
  longitude: -80.19,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

const MapScreen: React.FC<MapScreenProps> = ({ onBoatPress }) => {
  const isDarkMode = useColorScheme() === 'dark';
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [boats, setBoats] = useState<NearbyBoat[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const regionToRadiusKm = (r: Region): number => {
    // Approximate visible radius from latitude delta
    return Math.max((r.latitudeDelta * 111) / 2, 1);
  };

  const fetchNearbyBoats = useCallback(async (r: Region) => {
    setLoading(true);
    try {
      const radiusKm = regionToRadiusKm(r);
      const data = await BoatApiService.getNearbyBoats(r.latitude, r.longitude, radiusKm);
      setBoats(data.results);
    } catch (error) {
      console.error('Failed to fetch nearby boats:', error);
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
            fetchNearbyBoats(DEFAULT_REGION);
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
            fetchNearbyBoats(userRegion);
          },
          () => {
            setInitialLoad(false);
            fetchNearbyBoats(DEFAULT_REGION);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
      } catch {
        setInitialLoad(false);
        fetchNearbyBoats(DEFAULT_REGION);
      }
    };
    getLocation();
  }, [fetchNearbyBoats]);

  const handleRefresh = () => {
    fetchNearbyBoats(region);
  };

  const handleRegionChangeComplete = (newRegion: Region) => {
    setRegion(newRegion);
  };

  const handleMarkerPress = (boat: NearbyBoat) => {
    const detailData: DetailBoatData = {
      id: boat.id.toString(),
      name: boat.model
        ? `${boat.make || ''} ${boat.model}`.trim()
        : boat.make || 'Unknown Boat',
      make: boat.make || undefined,
      type: boat.boat_type || undefined,
      model: boat.model || undefined,
      image: boat.image_url ? { uri: boat.image_url } : undefined,
    };
    onBoatPress(detailData);
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
        {boats.map((boat) => (
          <Marker
            key={boat.id}
            coordinate={{ latitude: boat.latitude, longitude: boat.longitude }}
            title={boat.make || 'Boat'}
            description={boat.boat_type || undefined}
            onPress={() => handleMarkerPress(boat)}
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
          {boats.length} boat{boats.length !== 1 ? 's' : ''} nearby
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
