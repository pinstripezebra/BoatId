import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  FlatList,
  Image,
  Dimensions,
} from 'react-native';
import { AuthService } from '../services/authService';
import { BoatApiService } from '../services';

interface ProfileScreenProps {}

interface GridBoat {
  id: string;
  name: string;
  image_url?: string;
  make?: string;
  boat_type?: string;
}

type TabType = 'posts' | 'liked';

const GRID_GAP = 4;
const NUM_COLUMNS = 2;
const screenWidth = Dimensions.get('window').width;
const TILE_SIZE = (screenWidth - 40 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

const ProfileScreen: React.FC<ProfileScreenProps> = () => {
  const isDarkMode = useColorScheme() === 'dark';
  const [activeTab, setActiveTab] = useState<TabType>('posts');
  const [posts, setPosts] = useState<GridBoat[]>([]);
  const [likedBoats, setLikedBoats] = useState<GridBoat[]>([]);
  const [postsPage, setPostsPage] = useState(1);
  const [likedPage, setLikedPage] = useState(1);
  const [postsHasMore, setPostsHasMore] = useState(true);
  const [likedHasMore, setLikedHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [postsTotalCount, setPostsTotalCount] = useState(0);
  const [likedTotalCount, setLikedTotalCount] = useState(0);

  const bgColor = isDarkMode ? '#1a1a1a' : '#f8f9fa';
  const cardBg = isDarkMode ? '#2a2a2a' : '#ffffff';
  const textColor = isDarkMode ? '#ffffff' : '#333333';
  const subtextColor = isDarkMode ? '#aaaaaa' : '#666666';
  const tabActiveBg = '#2196f3';
  const tabInactiveBg = isDarkMode ? '#333333' : '#e0e0e0';

  const user = AuthService.getUser();

  const loadPosts = useCallback(async (page: number, append: boolean = false) => {
    try {
      const data = await BoatApiService.getIdentifications(page, 8, { isBoat: true });
      const mapped: GridBoat[] = data.results.map(item => ({
        id: item.id.toString(),
        name: item.identification_data?.model
          ? `${item.identification_data.make || ''} ${item.identification_data.model}`.trim()
          : item.identification_data?.make || 'Unknown Boat',
        image_url: item.image_url || undefined,
        make: item.identification_data?.make,
        boat_type: item.identification_data?.boat_type,
      }));
      setPosts(prev => append ? [...prev, ...mapped] : mapped);
      setPostsTotalCount(data.total_count);
      setPostsHasMore(page < data.total_pages);
    } catch (error) {
      console.error('Failed to load posts:', error);
    }
  }, []);

  const loadLikedBoats = useCallback(async (page: number, append: boolean = false) => {
    try {
      const data = await BoatApiService.getUserLikedBoats(page, 8);
      const mapped: GridBoat[] = data.results.map(item => ({
        id: item.id.toString(),
        name: item.model
          ? `${item.make || ''} ${item.model}`.trim()
          : item.make || 'Unknown Boat',
        image_url: item.image_url || undefined,
        make: item.make || undefined,
        boat_type: item.boat_type || undefined,
      }));
      setLikedBoats(prev => append ? [...prev, ...mapped] : mapped);
      setLikedTotalCount(data.total_count);
      setLikedHasMore(page < data.total_pages);
    } catch (error) {
      console.error('Failed to load liked boats:', error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([loadPosts(1), loadLikedBoats(1)]);
      setIsLoading(false);
    };
    init();
  }, [loadPosts, loadLikedBoats]);

  const handleLoadMore = async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    if (activeTab === 'posts' && postsHasMore) {
      const nextPage = postsPage + 1;
      await loadPosts(nextPage, true);
      setPostsPage(nextPage);
    } else if (activeTab === 'liked' && likedHasMore) {
      const nextPage = likedPage + 1;
      await loadLikedBoats(nextPage, true);
      setLikedPage(nextPage);
    }
    setIsLoadingMore(false);
  };

  const currentData = activeTab === 'posts' ? posts : likedBoats;
  const hasMore = activeTab === 'posts' ? postsHasMore : likedHasMore;
  const totalCount = activeTab === 'posts' ? postsTotalCount : likedTotalCount;

  const renderGridItem = ({ item }: { item: GridBoat }) => (
    <View style={[styles.gridItem, { backgroundColor: cardBg }]}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.gridImage} resizeMode="cover" />
      ) : (
        <View style={[styles.gridImage, styles.gridPlaceholder]}>
          <Text style={styles.placeholderEmoji}>🚤</Text>
        </View>
      )}
      <Text style={[styles.gridName, { color: textColor }]} numberOfLines={1}>
        {item.name}
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View>
      {/* Avatar & Name */}
      <View style={[styles.profileCard, { backgroundColor: cardBg }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.username ? user.username.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>
        <Text style={[styles.username, { color: textColor }]}>{user?.username || 'Unknown'}</Text>
        <Text style={[styles.role, { color: subtextColor }]}>{user?.role || 'user'}</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: textColor }]}>{postsTotalCount}</Text>
            <Text style={[styles.statLabel, { color: subtextColor }]}>Posts</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: textColor }]}>{likedTotalCount}</Text>
            <Text style={[styles.statLabel, { color: subtextColor }]}>Liked</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, { backgroundColor: activeTab === 'posts' ? tabActiveBg : tabInactiveBg }]}
          onPress={() => setActiveTab('posts')}>
          <Text style={[styles.tabText, { color: activeTab === 'posts' ? '#fff' : textColor }]}>My Posts</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, { backgroundColor: activeTab === 'liked' ? tabActiveBg : tabInactiveBg }]}
          onPress={() => setActiveTab('liked')}>
          <Text style={[styles.tabText, { color: activeTab === 'liked' ? '#fff' : textColor }]}>Liked</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (isLoadingMore) {
      return <ActivityIndicator size="small" color="#2196f3" style={styles.footerLoader} />;
    }
    if (hasMore && currentData.length > 0) {
      return (
        <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore}>
          <Text style={styles.loadMoreText}>Load More</Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }, styles.centered]}>
        <ActivityIndicator size="large" color="#2196f3" />
      </View>
    );
  }

  return (
    <FlatList
      style={[styles.container, { backgroundColor: bgColor }]}
      contentContainerStyle={styles.content}
      data={currentData}
      keyExtractor={item => `${activeTab}-${item.id}`}
      numColumns={NUM_COLUMNS}
      columnWrapperStyle={styles.gridRow}
      ListHeaderComponent={renderHeader}
      ListFooterComponent={renderFooter}
      ListEmptyComponent={
        <Text style={[styles.emptyText, { color: subtextColor }]}>
          {activeTab === 'posts' ? 'No boats posted yet' : 'No liked boats yet'}
        </Text>
      }
      renderItem={renderGridItem}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    paddingTop: 24,
  },
  profileCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2196f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  username: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  role: {
    fontSize: 14,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 32,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: GRID_GAP,
  },
  gridItem: {
    width: TILE_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  gridImage: {
    width: '100%',
    height: TILE_SIZE,
  },
  gridPlaceholder: {
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 36,
  },
  gridName: {
    fontSize: 12,
    fontWeight: '600',
    padding: 8,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
  footerLoader: {
    marginVertical: 16,
  },
  loadMoreButton: {
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2196f3',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  loadMoreText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default ProfileScreen;
