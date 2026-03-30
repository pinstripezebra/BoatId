import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { BoatApiService, type BoatIdentificationListResponse } from '../services';

interface PreviousResultsModalProps {
  visible: boolean;
  onClose: () => void;
}

type IdentificationItem = BoatIdentificationListResponse['results'][number];

const PreviousResultsModal: React.FC<PreviousResultsModalProps> = ({ visible, onClose }) => {
  const isDarkMode = useColorScheme() === 'dark';
  const [results, setResults] = useState<IdentificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const bgColor = isDarkMode ? '#1a1a1a' : '#f8f9fa';
  const cardBg = isDarkMode ? '#2a2a2a' : '#ffffff';
  const textColor = isDarkMode ? '#ffffff' : '#333333';
  const subtextColor = isDarkMode ? '#aaaaaa' : '#666666';

  useEffect(() => {
    if (visible) {
      setResults([]);
      setPage(1);
      setHasMore(true);
      loadResults(1);
    }
  }, [visible]);

  const loadResults = async (pageNum: number) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const data = await BoatApiService.getIdentifications(pageNum, 20);
      if (pageNum === 1) {
        setResults(data.results);
      } else {
        setResults(prev => [...prev, ...data.results]);
      }
      setHasMore(pageNum < data.total_pages);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load results:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = () => {
    if (hasMore && !isLoading) {
      loadResults(page + 1);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderItem = ({ item }: { item: IdentificationItem }) => {
    const data = item.identification_data;

    return (
      <View style={[styles.resultCard, { backgroundColor: cardBg }]}>
        <Image
          source={{ uri: item.image_url }}
          style={styles.resultImage}
          resizeMode="cover"
        />
        <View style={styles.resultInfo}>
          <View style={styles.resultHeader}>
            <Text style={[styles.boatStatus, { color: item.is_boat ? '#4CAF50' : '#F44336' }]}>
              {item.is_boat ? '🚤 Boat' : '❌ Not a Boat'}
            </Text>
            {data?.confidence && (
              <Text style={[styles.confidence, { color: subtextColor }]}>
                {data.confidence}
              </Text>
            )}
          </View>

          {item.is_boat && data && (
            <View style={styles.detailsGrid}>
              {data.make && (
                <DetailRow label="Make" value={data.make} textColor={textColor} subtextColor={subtextColor} />
              )}
              {data.model && (
                <DetailRow label="Model" value={data.model} textColor={textColor} subtextColor={subtextColor} />
              )}
              {data.boat_type && (
                <DetailRow label="Type" value={data.boat_type} textColor={textColor} subtextColor={subtextColor} />
              )}
              {data.year && (
                <DetailRow label="Year" value={data.year} textColor={textColor} subtextColor={subtextColor} />
              )}
              {data.length && (
                <DetailRow label="Length" value={data.length} textColor={textColor} subtextColor={subtextColor} />
              )}
              {data.hull_material && (
                <DetailRow label="Hull" value={data.hull_material} textColor={textColor} subtextColor={subtextColor} />
              )}
              {data.description && (
                <Text style={[styles.description, { color: subtextColor }]} numberOfLines={3}>
                  {data.description}
                </Text>
              )}
            </View>
          )}

          <Text style={[styles.dateText, { color: subtextColor }]}>
            {formatDate(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <View style={[styles.header, { backgroundColor: cardBg }]}>
          <Text style={[styles.headerTitle, { color: textColor }]}>Previous Results</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {isLoading && results.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#2196f3" />
            <Text style={[styles.loadingText, { color: textColor }]}>Loading results...</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.centered}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🚤</Text>
            <Text style={[styles.emptyText, { color: textColor }]}>No identifications yet</Text>
            <Text style={[styles.emptySubtext, { color: subtextColor }]}>
              Use the camera to identify your first boat!
            </Text>
          </View>
        ) : (
          <FlatList
            data={results}
            renderItem={renderItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContent}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isLoading ? (
                <ActivityIndicator style={styles.footerLoader} color="#2196f3" />
              ) : null
            }
          />
        )}
      </View>
    </Modal>
  );
};

const DetailRow: React.FC<{
  label: string;
  value: string;
  textColor: string;
  subtextColor: string;
}> = ({ label, value, textColor, subtextColor }) => (
  <View style={styles.detailRow}>
    <Text style={[styles.detailLabel, { color: subtextColor }]}>{label}</Text>
    <Text style={[styles.detailValue, { color: textColor }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 48,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  listContent: {
    padding: 16,
  },
  resultCard: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  resultImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#e0e0e0',
  },
  resultInfo: {
    padding: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  boatStatus: {
    fontSize: 16,
    fontWeight: '600',
  },
  confidence: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  detailsGrid: {
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
  },
  description: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  dateText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
  },
});

export default PreviousResultsModal;
