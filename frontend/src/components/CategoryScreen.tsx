import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  useColorScheme,
  Dimensions,
} from 'react-native';
import CarCard, { type CarCardData } from './CarCard';
import type { DetailCarData } from './CarDetailModal';
import { CarApiService } from '../services/carApi';

const PAGE_SIZE = 20;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_MARGIN = 8;
const NUM_COLUMNS = 2;
const CARD_WIDTH = (SCREEN_WIDTH - CARD_MARGIN * (NUM_COLUMNS + 1) * 2) / NUM_COLUMNS;

export type CategoryType = 'popular' | 'nearby';

interface CategoryScreenProps {
  title: string;
  category: CategoryType;
  onBack: () => void;
  onCarPress: (car: DetailCarData) => void;
  isLiked?: (id: string) => boolean;
  onLikeToggle?: (id: string) => void;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
}

function mapPopularCar(item: any): DetailCarData {
  return {
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
  };
}

function mapNearbyCar(item: any): DetailCarData {
  return {
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
  };
}

const CategoryScreen: React.FC<CategoryScreenProps> = ({
  title,
  category,
  onBack,
  onCarPress,
  isLiked,
  onLikeToggle,
  latitude = 39.8,
  longitude = -98.6,
  radiusKm = 5000,
}) => {
  const isDarkMode = useColorScheme() === 'dark';
  const bgColor = isDarkMode ? '#1a1a1a' : '#f8f9fa';
  const textColor = isDarkMode ? '#ffffff' : '#333333';
  const headerBg = isDarkMode ? '#222222' : '#ffffff';
  const borderColor = isDarkMode ? '#333333' : '#e0e0e0';

  const [cars, setCars] = useState<DetailCarData[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchPage = useCallback(async (pageNum: number) => {
    if (loading) return;
    setLoading(true);
    try {
      if (category === 'popular') {
        const data = await CarApiService.getPopularCars(pageNum, PAGE_SIZE);
        const mapped = data.results.map(mapPopularCar);
        setCars(prev => pageNum === 1 ? mapped : [...prev, ...mapped]);
        setTotalPages(data.total_pages);
      } else {
        const data = await CarApiService.getNearbyCars(latitude, longitude, radiusKm, pageNum, PAGE_SIZE);
        const mapped = data.results.map(mapNearbyCar);
        setCars(prev => pageNum === 1 ? mapped : [...prev, ...mapped]);
        setTotalPages(data.total_pages);
      }
    } catch (err) {
      console.error(`Failed to load ${category} cars (page ${pageNum}):`, err);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [category, latitude, longitude, radiusKm, loading]);

  useEffect(() => {
    fetchPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(() => {
    if (!loading && page < totalPages) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPage(nextPage);
    }
  }, [loading, page, totalPages, fetchPage]);

  const renderFooter = () => {
    if (!loading || initialLoading) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  };

  const renderEmpty = () => {
    if (initialLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: textColor }]}>No cars found</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: borderColor }]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>{title}</Text>
        <View style={styles.backButton} />
      </View>

      {initialLoading ? (
        <View style={styles.centeredLoader}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={cars}
          keyExtractor={item => item.id}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={[styles.grid, { backgroundColor: bgColor }]}
          columnWrapperStyle={styles.row}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <CarCard
                {...item}
                onPress={() => onCarPress(item)}
                isLiked={isLiked?.(item.id)}
                onLikeToggle={onLikeToggle}
              />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 22,
    color: '#007AFF',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  centeredLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    paddingHorizontal: CARD_MARGIN,
    paddingTop: CARD_MARGIN,
    paddingBottom: 24,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: CARD_MARGIN * 2,
  },
  cardWrapper: {
    flex: 1,
    marginHorizontal: CARD_MARGIN,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
  },
});

export default CategoryScreen;
