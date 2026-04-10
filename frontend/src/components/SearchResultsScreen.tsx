import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  FlatList,
} from 'react-native';
import BoatCard from './BoatCard';
import type { BoatCardData } from './BoatCard';
import { BoatApiService } from '../services';
import type { SearchResult } from '../services/boatApi';

interface SearchResultsScreenProps {
  query: string;
  onBack: () => void;
  onBoatPress: (boat: any) => void;
  isLiked: (id: string) => boolean;
  onLikeToggle: (id: string) => void;
}

const EXAMPLE_SEARCHES = ['Sailboat', 'Yamaha', 'Bowrider', 'Boston Whaler', 'Fishing boat', 'Pontoon'];
const PER_PAGE = 8;

const SearchResultsScreen: React.FC<SearchResultsScreenProps> = ({
  query,
  onBack,
  onBoatPress,
  isLiked,
  onLikeToggle,
}) => {
  const isDarkMode = useColorScheme() === 'dark';
  const [results, setResults] = useState<BoatCardData[]>([]);
  const [rawResults, setRawResults] = useState<SearchResult[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const bgColor = isDarkMode ? '#1a1a1a' : '#f8f9fa';
  const textColor = isDarkMode ? '#ffffff' : '#333333';
  const subtextColor = isDarkMode ? '#aaaaaa' : '#666666';
  const cardBg = isDarkMode ? '#2a2a2a' : '#ffffff';

  const mapResult = (item: SearchResult): BoatCardData => ({
    id: item.id.toString(),
    name: item.model
      ? `${item.make || ''} ${item.model}`.trim()
      : item.make || 'Unknown Boat',
    make: item.make || undefined,
    type: item.boat_type || undefined,
    image: item.image_url ? { uri: item.image_url } : undefined,
  });

  const fetchResults = useCallback(async (pageNum: number, append: boolean) => {
    try {
      const data = await BoatApiService.searchBoats(query, pageNum, PER_PAGE);
      const mapped = data.results.map(mapResult);
      setResults(prev => append ? [...prev, ...mapped] : mapped);
      setRawResults(prev => append ? [...prev, ...data.results] : data.results);
      setTotalCount(data.total_count);
      setHasMore(pageNum < data.total_pages);
    } catch (error) {
      console.error('Search failed:', error);
    }
  }, [query]);

  useEffect(() => {
    setIsLoading(true);
    setPage(1);
    setResults([]);
    setRawResults([]);
    fetchResults(1, false).finally(() => setIsLoading(false));
  }, [query, fetchResults]);

  const handleLoadMore = async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    await fetchResults(nextPage, true);
    setPage(nextPage);
    setIsLoadingMore(false);
  };

  const handleBoatPress = (item: BoatCardData, index: number) => {
    const raw = rawResults[index];
    if (raw) {
      onBoatPress({
        id: raw.id.toString(),
        name: item.name,
        make: raw.make,
        model: raw.model,
        boatType: raw.boat_type,
        yearEstimate: raw.year_estimate,
        confidence: raw.confidence,
        description: raw.identification_data?.description,
        imageUrl: raw.image_url,
      });
    }
  };

  const renderItem = ({ item, index }: { item: BoatCardData; index: number }) => (
    <View style={styles.cardWrapper}>
      <BoatCard
        {...item}
        onPress={() => handleBoatPress(item, index)}
        isLiked={isLiked(item.id)}
        onLikeToggle={onLikeToggle}
      />
    </View>
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyIcon]}>🔍</Text>
        <Text style={[styles.emptyTitle, { color: textColor }]}>No results found</Text>
        <Text style={[styles.emptySubtitle, { color: subtextColor }]}>
          Try searching for something else
        </Text>
        <View style={styles.suggestionsContainer}>
          <Text style={[styles.suggestionsLabel, { color: subtextColor }]}>
            Example searches:
          </Text>
          <View style={styles.chipRow}>
            {EXAMPLE_SEARCHES.map(s => (
              <View key={s} style={[styles.chip, { backgroundColor: cardBg }]}>
                <Text style={[styles.chipText, { color: textColor }]}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderFooter = () => {
    if (!hasMore) return null;
    return (
      <TouchableOpacity
        style={[styles.loadMoreButton, { backgroundColor: cardBg }]}
        onPress={handleLoadMore}
        disabled={isLoadingMore}>
        {isLoadingMore ? (
          <ActivityIndicator size="small" color="#2196f3" />
        ) : (
          <Text style={[styles.loadMoreText, { color: '#2196f3' }]}>Load More</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTextGroup}>
          <Text style={[styles.headerTitle, { color: textColor }]} numberOfLines={1}>
            Results for "{query}"
          </Text>
          {!isLoading && (
            <Text style={[styles.headerCount, { color: subtextColor }]}>
              {totalCount} {totalCount === 1 ? 'result' : 'results'}
            </Text>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196f3" />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  backArrow: {
    fontSize: 24,
    color: '#2196f3',
  },
  headerTextGroup: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerCount: {
    fontSize: 13,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardWrapper: {
    width: '48%',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  suggestionsContainer: {
    alignItems: 'center',
    width: '100%',
  },
  suggestionsLabel: {
    fontSize: 13,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  chipText: {
    fontSize: 14,
  },
  loadMoreButton: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  loadMoreText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default SearchResultsScreen;
