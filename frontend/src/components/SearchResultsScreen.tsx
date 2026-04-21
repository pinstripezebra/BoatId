import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  FlatList,
} from 'react-native';
import CarCard from './CarCard';
import CachedImage from './CachedImage';
import type { CarCardData } from './CarCard';
import { CarApiService } from '../services';
import type { SearchResult } from '../services/carApi';

interface SearchResultsScreenProps {
  onBack: () => void;
  onCarPress: (car: any) => void;
  isLiked: (id: string) => boolean;
  onLikeToggle: (id: string) => void;
}

const EXAMPLE_SEARCHES = ['Sedan', 'Toyota', 'SUV', 'Ford Mustang', 'Sports car', 'Tesla'];
const PER_PAGE = 8;

const SearchResultsScreen: React.FC<SearchResultsScreenProps> = ({
  onBack,
  onCarPress,
  isLiked,
  onLikeToggle,
}) => {
  const isDarkMode = useColorScheme() === 'dark';
  const [text, setText] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [results, setResults] = useState<CarCardData[]>([]);
  const [rawResults, setRawResults] = useState<SearchResult[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const bgColor = isDarkMode ? '#1a1a1a' : '#f8f9fa';
  const textColor = isDarkMode ? '#ffffff' : '#333333';
  const subtextColor = isDarkMode ? '#aaaaaa' : '#666666';
  const cardBg = isDarkMode ? '#2a2a2a' : '#ffffff';
  const inputBg = isDarkMode ? '#333333' : '#f0f0f0';

  // Auto-focus the input when the screen mounts
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const mapResult = (item: SearchResult): CarCardData => ({
    id: item.id.toString(),
    name: item.model
      ? `${item.make || ''} ${item.model}`.trim()
      : item.make || 'Unknown Car',
    make: item.make || undefined,
    type: item.car_type || undefined,
    image: item.image_url ? { uri: item.image_url } : undefined,
  });

  const fetchResults = useCallback(async (query: string, pageNum: number, append: boolean) => {
    try {
      const data = await CarApiService.searchCars(query, pageNum, PER_PAGE);
      const mapped = data.results.map(mapResult);
      setResults(prev => append ? [...prev, ...mapped] : mapped);
      setRawResults(prev => append ? [...prev, ...data.results] : data.results);
      setTotalCount(data.total_count);
      setHasMore(pageNum < data.total_pages);
    } catch (error) {
      console.error('Search failed:', error);
    }
  }, []);

  const executeSearch = useCallback((query: string) => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setActiveQuery('');
      setResults([]);
      setRawResults([]);
      setTotalCount(0);
      return;
    }
    setActiveQuery(trimmed);
    setPage(1);
    setIsLoading(true);
    fetchResults(trimmed, 1, false).finally(() => setIsLoading(false));
  }, [fetchResults]);

  const handleChangeText = useCallback((value: string) => {
    setText(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      executeSearch(value);
    }, 500);
  }, [executeSearch]);

  const handleSubmit = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    executeSearch(text);
  }, [text, executeSearch]);

  const handleSuggestionPress = useCallback((suggestion: string) => {
    setText(suggestion);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    executeSearch(suggestion);
  }, [executeSearch]);

  const handleLoadMore = async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    await fetchResults(activeQuery, nextPage, true);
    setPage(nextPage);
    setIsLoadingMore(false);
  };

  const handleCarPress = (item: CarCardData, index: number) => {
    const raw = rawResults[index];
    if (raw) {
      onCarPress({
        id: raw.id.toString(),
        name: item.name,
        make: raw.make,
        model: raw.model,
        carType: raw.car_type,
        yearEstimate: raw.year_estimate,
        confidence: raw.confidence,
        description: raw.identification_data?.description,
        imageUrl: raw.image_url,
      });
    }
  };

  const renderItem = ({ item, index }: { item: CarCardData; index: number }) => (
    <View style={styles.cardWrapper}>
      <CarCard
        {...item}
        onPress={() => handleCarPress(item, index)}
        isLiked={isLiked(item.id)}
        onLikeToggle={onLikeToggle}
      />
    </View>
  );

  const renderSuggestions = () => (
    <View style={styles.suggestionsContainer}>
      <Text style={[styles.suggestionsLabel, { color: subtextColor }]}>
        Try searching for:
      </Text>
      <View style={styles.chipRow}>
        {EXAMPLE_SEARCHES.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, { backgroundColor: cardBg }]}
            onPress={() => handleSuggestionPress(s)}>
            <Text style={[styles.chipText, { color: textColor }]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderNoResults = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🔍</Text>
      <Text style={[styles.emptyTitle, { color: textColor }]}>No results found</Text>
      <Text style={[styles.emptySubtitle, { color: subtextColor }]}>
        Try a different search term
      </Text>
      {renderSuggestions()}
    </View>
  );

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

  const renderResultsHeader = () => {
    if (!activeQuery) return null;
    return (
      <View style={styles.resultsHeader}>
        <Text style={[styles.resultsCount, { color: subtextColor }]}>
          {totalCount} {totalCount === 1 ? 'result' : 'results'}
        </Text>
      </View>
    );
  };

  // Determine body content
  const renderBody = () => {
    // No query yet — show suggestions
    if (!activeQuery) {
      return (
        <View style={styles.initialContainer}>
          {renderSuggestions()}
        </View>
      );
    }

    // Loading first page
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196f3" />
        </View>
      );
    }

    // Has results
    return (
      <FlatList
        data={results}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderResultsHeader}
        ListEmptyComponent={renderNoResults}
        ListFooterComponent={renderFooter}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={styles.header}>
        <View style={[styles.searchInputContainer, { backgroundColor: inputBg }]}>
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: textColor }]}
            placeholder="🔍  Search cars..."
            placeholderTextColor={isDarkMode ? '#888888' : '#999999'}
            value={text}
            onChangeText={handleChangeText}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {renderBody()}
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
    paddingVertical: 10,
  },
  searchInputContainer: {
    flex: 1,
    borderRadius: 12,
  },
  searchInput: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
  },
  backButton: {
    marginLeft: 12,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 16,
    color: '#2196f3',
    fontWeight: '500',
  },
  initialContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsHeader: {
    paddingBottom: 12,
  },
  resultsCount: {
    fontSize: 13,
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
    paddingHorizontal: 32,
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
