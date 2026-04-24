import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
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
  ScrollView,
  PanResponder,
} from 'react-native';
import CarCard from './CarCard';
import type {DetailCarData} from './CarDetailModal';
import {CarApiService} from '../services/carApi';

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;
const CARD_MARGIN = 8;
const NUM_COLUMNS = 2;
const THUMB_RADIUS = 12;

// ─── Types ────────────────────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseYear(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/\d{4}/);
  return m ? parseInt(m[0], 10) : null;
}

function mapCar(item: any): DetailCarData {
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
    image: item.image_url ? {uri: item.image_url} : undefined,
    identification_data: item.identification_data,
  };
}

// ─── ChipRow ──────────────────────────────────────────────────────────────────
interface ChipRowProps {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  isDarkMode: boolean;
}

const ChipRow: React.FC<ChipRowProps> = ({
  label,
  options,
  selected,
  onToggle,
  isDarkMode,
}) => {
  if (options.length === 0) return null;
  const labelColor = isDarkMode ? '#aaaaaa' : '#888888';
  const chipBg = isDarkMode ? '#333333' : '#eeeeee';
  const chipText = isDarkMode ? '#ffffff' : '#333333';

  return (
    <View style={chipStyles.row}>
      <Text style={[chipStyles.label, {color: labelColor}]}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={chipStyles.scroll}>
        {options.map(opt => {
          const active = selected.has(opt);
          return (
            <TouchableOpacity
              key={opt}
              style={[
                chipStyles.chip,
                {backgroundColor: active ? '#007AFF' : chipBg},
              ]}
              onPress={() => onToggle(opt)}
              activeOpacity={0.7}>
              <Text
                style={[
                  chipStyles.chipText,
                  {color: active ? '#ffffff' : chipText},
                ]}>
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const chipStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  label: {
    width: 52,
    fontSize: 12,
    fontWeight: '600',
    paddingLeft: 12,
    flexShrink: 0,
  },
  scroll: {
    paddingHorizontal: 4,
    paddingRight: 12,
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
});

// ─── RangeSlider ──────────────────────────────────────────────────────────────
interface RangeSliderProps {
  min: number;
  max: number;
  low: number;
  high: number;
  onLowChange: (v: number) => void;
  onHighChange: (v: number) => void;
  isDarkMode: boolean;
}

const RangeSlider: React.FC<RangeSliderProps> = ({
  min,
  max,
  low,
  high,
  onLowChange,
  onHighChange,
  isDarkMode,
}) => {
  const [trackWidth, setTrackWidth] = useState(0);

  // Mirror all mutable values into a ref so PanResponder handlers are never stale
  const r = useRef({low, high, min, max, trackWidth: 0, onLowChange, onHighChange});
  r.current = {low, high, min, max, trackWidth: r.current.trackWidth, onLowChange, onHighChange};

  const toPos = (v: number): number => {
    const {min: mn, max: mx, trackWidth: tw} = r.current;
    if (tw === 0 || mx === mn) return 0;
    return ((v - mn) / (mx - mn)) * tw;
  };

  const toVal = (x: number): number => {
    const {min: mn, max: mx, trackWidth: tw} = r.current;
    if (tw === 0) return mn;
    return Math.round(mn + (Math.max(0, Math.min(tw, x)) / tw) * (mx - mn));
  };

  const lowStartX = useRef(0);
  const highStartX = useRef(0);

  const lowPR = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        lowStartX.current = toPos(r.current.low);
      },
      onPanResponderMove: (_, gs) => {
        const highPos = toPos(r.current.high);
        const newX = Math.max(0, Math.min(highPos - 1, lowStartX.current + gs.dx));
        r.current.onLowChange(toVal(newX));
      },
    }),
  ).current;

  const highPR = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        highStartX.current = toPos(r.current.high);
      },
      onPanResponderMove: (_, gs) => {
        const {trackWidth: tw} = r.current;
        const lowPos = toPos(r.current.low);
        const newX = Math.min(tw, Math.max(lowPos + 1, highStartX.current + gs.dx));
        r.current.onHighChange(toVal(newX));
      },
    }),
  ).current;

  const trackColor = isDarkMode ? '#555555' : '#dddddd';
  const labelColor = isDarkMode ? '#aaaaaa' : '#888888';
  const valueColor = isDarkMode ? '#ffffff' : '#333333';
  const lowPos = toPos(low);
  const highPos = toPos(high);

  return (
    <View style={sliderStyles.container}>
      <View style={sliderStyles.labelRow}>
        <Text style={[sliderStyles.fieldLabel, {color: labelColor}]}>Year</Text>
        <Text style={[sliderStyles.rangeText, {color: valueColor}]}>
          {low} – {high}
        </Text>
      </View>
      <View style={sliderStyles.trackPadding}>
        <View
          style={[sliderStyles.track, {backgroundColor: trackColor}]}
          onLayout={e => {
            const w = e.nativeEvent.layout.width;
            r.current.trackWidth = w;
            setTrackWidth(w);
          }}>
          <View
            style={[
              sliderStyles.activeTrack,
              {left: lowPos, width: Math.max(0, highPos - lowPos)},
            ]}
          />
          <View
            {...lowPR.panHandlers}
            style={[sliderStyles.thumb, {left: lowPos - THUMB_RADIUS}]}
          />
          <View
            {...highPR.panHandlers}
            style={[sliderStyles.thumb, {left: highPos - THUMB_RADIUS}]}
          />
        </View>
      </View>
    </View>
  );
};

const sliderStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  fieldLabel: {
    width: 52,
    fontSize: 12,
    fontWeight: '600',
  },
  rangeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  trackPadding: {
    paddingHorizontal: THUMB_RADIUS,
  },
  track: {
    height: 4,
    borderRadius: 2,
  },
  activeTrack: {
    position: 'absolute',
    height: 4,
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    top: -(THUMB_RADIUS - 2),
    width: THUMB_RADIUS * 2,
    height: THUMB_RADIUS * 2,
    borderRadius: THUMB_RADIUS,
    backgroundColor: '#007AFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
});

// ─── CategoryScreen ───────────────────────────────────────────────────────────
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
  const filterBg = isDarkMode ? '#1e1e1e' : '#fafafa';

  // ── Data state ───────────────────────────────────────────────────────────────
  const [cars, setCars] = useState<DetailCarData[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const loadingRef = useRef(false);

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [makeFilter, setMakeFilter] = useState<Set<string>>(new Set());
  const [modelFilter, setModelFilter] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [yearRange, setYearRange] = useState<[number, number]>([0, 0]);

  // ── Derived filter options ────────────────────────────────────────────────────
  const {makes, models, types, yearBounds} = useMemo(() => {
    const makeSet = new Set<string>();
    const modelSet = new Set<string>();
    const typeSet = new Set<string>();
    const years: number[] = [];
    for (const car of cars) {
      if (car.make) makeSet.add(car.make);
      if (car.model) modelSet.add(car.model);
      if (car.type) typeSet.add(car.type);
      const y = parseYear(car.year);
      if (y !== null) years.push(y);
    }
    const minY = years.length ? Math.min(...years) : 0;
    const maxY = years.length ? Math.max(...years) : 0;
    return {
      makes: [...makeSet].sort(),
      models: [...modelSet].sort(),
      types: [...typeSet].sort(),
      yearBounds: [minY, maxY] as [number, number],
    };
  }, [cars]);

  // Initialise yearRange once when year data first becomes available
  useEffect(() => {
    if (yearRange[0] === 0 && yearRange[1] === 0 && yearBounds[0] !== 0) {
      setYearRange(yearBounds);
    }
  }, [yearBounds, yearRange]);

  const showYearSlider = yearBounds[0] !== 0 && yearBounds[0] !== yearBounds[1];
  const isYearFiltered =
    showYearSlider &&
    (yearRange[0] > yearBounds[0] || yearRange[1] < yearBounds[1]);
  const isFiltered =
    makeFilter.size > 0 ||
    modelFilter.size > 0 ||
    typeFilter.size > 0 ||
    isYearFiltered;

  // ── Filtered cars ────────────────────────────────────────────────────────────
  const filteredCars = useMemo(() => {
    return cars.filter(car => {
      if (makeFilter.size > 0 && !makeFilter.has(car.make ?? '')) return false;
      if (modelFilter.size > 0 && !modelFilter.has(car.model ?? '')) return false;
      if (typeFilter.size > 0 && !typeFilter.has(car.type ?? '')) return false;
      if (isYearFiltered) {
        const y = parseYear(car.year);
        if (y === null || y < yearRange[0] || y > yearRange[1]) return false;
      }
      return true;
    });
  }, [cars, makeFilter, modelFilter, typeFilter, yearRange, isYearFiltered]);

  // ── Toggle helpers ────────────────────────────────────────────────────────────
  const toggleMake = useCallback((v: string) => {
    setMakeFilter(prev => {
      const next = new Set(prev);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });
  }, []);

  const toggleModel = useCallback((v: string) => {
    setModelFilter(prev => {
      const next = new Set(prev);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });
  }, []);

  const toggleType = useCallback((v: string) => {
    setTypeFilter(prev => {
      const next = new Set(prev);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setMakeFilter(new Set());
    setModelFilter(new Set());
    setTypeFilter(new Set());
    setYearRange(yearBounds);
  }, [yearBounds]);

  // ── Data fetching ─────────────────────────────────────────────────────────────
  const fetchPage = useCallback(
    async (pageNum: number) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      try {
        if (category === 'popular') {
          const data = await CarApiService.getPopularCars(pageNum, PAGE_SIZE);
          const mapped = data.results.map(mapCar);
          setCars(prev => (pageNum === 1 ? mapped : [...prev, ...mapped]));
          setTotalPages(data.total_pages);
        } else {
          const data = await CarApiService.getNearbyCars(
            latitude,
            longitude,
            radiusKm,
            pageNum,
            PAGE_SIZE,
          );
          const mapped = data.results.map(mapCar);
          setCars(prev => (pageNum === 1 ? mapped : [...prev, ...mapped]));
          setTotalPages(data.total_pages);
        }
      } catch (err) {
        console.error(`Failed to load ${category} cars (page ${pageNum}):`, err);
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [category, latitude, longitude, radiusKm],
  );

  useEffect(() => {
    fetchPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(() => {
    if (!loadingRef.current && page < totalPages) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPage(nextPage);
    }
  }, [page, totalPages, fetchPage]);

  // ── Render helpers ────────────────────────────────────────────────────────────
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
        <Text style={[styles.emptyText, {color: textColor}]}>
          {isFiltered ? 'No cars match these filters' : 'No cars found'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, {backgroundColor: bgColor}]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {backgroundColor: headerBg, borderBottomColor: borderColor},
        ]}>
        <TouchableOpacity
          style={styles.headerSide}
          onPress={onBack}
          activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: textColor}]}>{title}</Text>
        {isFiltered ? (
          <TouchableOpacity
            style={[styles.headerSide, styles.clearSide]}
            onPress={clearFilters}
            activeOpacity={0.7}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSide} />
        )}
      </View>

      {/* Filter bar — shown once initial data is loaded */}
      {!initialLoading && (
        <View
          style={[
            styles.filterBar,
            {backgroundColor: filterBg, borderBottomColor: borderColor},
          ]}>
          <ChipRow
            label="Make"
            options={makes}
            selected={makeFilter}
            onToggle={toggleMake}
            isDarkMode={isDarkMode}
          />
          <ChipRow
            label="Model"
            options={models}
            selected={modelFilter}
            onToggle={toggleModel}
            isDarkMode={isDarkMode}
          />
          <ChipRow
            label="Type"
            options={types}
            selected={typeFilter}
            onToggle={toggleType}
            isDarkMode={isDarkMode}
          />
          {showYearSlider && (
            <RangeSlider
              min={yearBounds[0]}
              max={yearBounds[1]}
              low={yearRange[0]}
              high={yearRange[1]}
              onLowChange={v => setYearRange(prev => [v, prev[1]])}
              onHighChange={v => setYearRange(prev => [prev[0], v])}
              isDarkMode={isDarkMode}
            />
          )}
          {isFiltered && (
            <Text
              style={[
                styles.resultCount,
                {color: isDarkMode ? '#aaaaaa' : '#888888'},
              ]}>
              {filteredCars.length} of {cars.length} loaded
            </Text>
          )}
        </View>
      )}

      {initialLoading ? (
        <View style={styles.centeredLoader}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={filteredCars}
          keyExtractor={item => item.id}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={[styles.grid, {backgroundColor: bgColor}]}
          columnWrapperStyle={styles.row}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          renderItem={({item}) => (
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
  headerSide: {
    width: 52,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  clearSide: {
    alignItems: 'flex-end',
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
  clearText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  filterBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
  },
  resultCount: {
    fontSize: 12,
    textAlign: 'center',
    paddingBottom: 6,
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
