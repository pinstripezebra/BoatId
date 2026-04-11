import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  useColorScheme,
  FlatList,
  Image,
  Dimensions,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { AuthService } from '../services/authService';
import { CarApiService } from '../services';
import PrivacyPolicyScreen from './PrivacyPolicyScreen';

interface ProfileScreenProps {
  onLogout: () => void;
}

interface GridCar {
  id: string;
  name: string;
  image_url?: string;
  make?: string;
  car_type?: string;
}

type TabType = 'posts' | 'liked';

const GRID_GAP = 4;
const NUM_COLUMNS = 2;
const screenWidth = Dimensions.get('window').width;
const TILE_SIZE = (screenWidth - 40 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

const ProfileScreen: React.FC<ProfileScreenProps> = ({ onLogout }) => {
  const isDarkMode = useColorScheme() === 'dark';
  const [activeTab, setActiveTab] = useState<TabType>('posts');
  const [posts, setPosts] = useState<GridCar[]>([]);
  const [likedCars, setLikedCars] = useState<GridCar[]>([]);
  const [postsPage, setPostsPage] = useState(1);
  const [likedPage, setLikedPage] = useState(1);
  const [postsHasMore, setPostsHasMore] = useState(true);
  const [likedHasMore, setLikedHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [postsTotalCount, setPostsTotalCount] = useState(0);
  const [likedTotalCount, setLikedTotalCount] = useState(0);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  const bgColor = isDarkMode ? '#1a1a1a' : '#f8f9fa';
  const cardBg = isDarkMode ? '#2a2a2a' : '#ffffff';
  const textColor = isDarkMode ? '#ffffff' : '#333333';
  const subtextColor = isDarkMode ? '#aaaaaa' : '#666666';
  const tabActiveBg = '#2196f3';
  const tabInactiveBg = isDarkMode ? '#333333' : '#e0e0e0';

  const user = AuthService.getUser();

  const loadPosts = useCallback(async (page: number, append: boolean = false) => {
    try {
      const data = await CarApiService.getIdentifications(page, 8, { isCar: true });
      const mapped: GridCar[] = data.results.map(item => ({
        id: item.id.toString(),
        name: item.identification_data?.model
          ? `${item.identification_data.make || ''} ${item.identification_data.model}`.trim()
          : item.identification_data?.make || 'Unknown Car',
        image_url: item.image_url || undefined,
        make: item.identification_data?.make,
        car_type: item.identification_data?.car_type,
      }));
      setPosts(prev => append ? [...prev, ...mapped] : mapped);
      setPostsTotalCount(data.total_count);
      setPostsHasMore(page < data.total_pages);
    } catch (error) {
      console.error('Failed to load posts:', error);
    }
  }, []);

  const loadLikedCars = useCallback(async (page: number, append: boolean = false) => {
    try {
      const data = await CarApiService.getUserLikedCars(page, 8);
      const mapped: GridCar[] = data.results.map(item => ({
        id: item.id.toString(),
        name: item.model
          ? `${item.make || ''} ${item.model}`.trim()
          : item.make || 'Unknown Car',
        image_url: item.image_url || undefined,
        make: item.make || undefined,
        car_type: item.car_type || undefined,
      }));
      setLikedCars(prev => append ? [...prev, ...mapped] : mapped);
      setLikedTotalCount(data.total_count);
      setLikedHasMore(page < data.total_pages);
    } catch (error) {
      console.error('Failed to load liked cars:', error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([loadPosts(1), loadLikedCars(1)]);
      setIsLoading(false);
    };
    init();
  }, [loadPosts, loadLikedCars]);

  const handleLoadMore = async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    if (activeTab === 'posts' && postsHasMore) {
      const nextPage = postsPage + 1;
      await loadPosts(nextPage, true);
      setPostsPage(nextPage);
    } else if (activeTab === 'liked' && likedHasMore) {
      const nextPage = likedPage + 1;
      await loadLikedCars(nextPage, true);
      setLikedPage(nextPage);
    }
    setIsLoadingMore(false);
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await AuthService.deleteAccount();
      setShowDeleteModal(false);
      onLogout();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete account';
      Alert.alert('Error', message);
    } finally {
      setIsDeleting(false);
    }
  };

  const currentData = activeTab === 'posts' ? posts : likedCars;
  const hasMore = activeTab === 'posts' ? postsHasMore : likedHasMore;
  const totalCount = activeTab === 'posts' ? postsTotalCount : likedTotalCount;

  const renderGridItem = ({ item }: { item: GridCar }) => (
    <View style={[styles.gridItem, { backgroundColor: cardBg }]}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.gridImage} resizeMode="cover" />
      ) : (
        <View style={[styles.gridImage, styles.gridPlaceholder]}>
          <Text style={styles.placeholderEmoji}>🚗</Text>
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
        <View style={styles.profileCardHeader}>
          <View style={styles.gearSpacer} />
          <TouchableOpacity
            onPress={() => setShowSettingsMenu(!showSettingsMenu)}
            style={styles.gearButton}>
            <Text style={[styles.gearIcon, { color: subtextColor }]}>⚙️</Text>
          </TouchableOpacity>
        </View>
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

  if (showPrivacyPolicy) {
    return <PrivacyPolicyScreen onClose={() => setShowPrivacyPolicy(false)} />;
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }, styles.centered]}>
        <ActivityIndicator size="large" color="#2196f3" />
      </View>
    );
  }

  return (
    <>
      {showSettingsMenu && (
        <TouchableWithoutFeedback onPress={() => setShowSettingsMenu(false)}>
          <View style={styles.settingsOverlay}>
            <View style={[styles.settingsDropdown, { backgroundColor: cardBg }]}>
              <TouchableOpacity
                style={styles.settingsItem}
                onPress={() => {
                  setShowSettingsMenu(false);
                  setShowPrivacyPolicy(true);
                }}>
                <Text style={[styles.settingsItemText, { color: textColor }]}>Privacy Policy</Text>
              </TouchableOpacity>
              <View style={[styles.settingsDivider, { backgroundColor: isDarkMode ? '#444' : '#e0e0e0' }]} />
              <TouchableOpacity
                style={styles.settingsItem}
                onPress={() => {
                  setShowSettingsMenu(false);
                  onLogout();
                }}>
                <Text style={[styles.settingsItemText, { color: textColor }]}>Sign Out</Text>
              </TouchableOpacity>
              <View style={[styles.settingsDivider, { backgroundColor: isDarkMode ? '#444' : '#e0e0e0' }]} />
              <TouchableOpacity
                style={styles.settingsItem}
                onPress={() => {
                  setShowSettingsMenu(false);
                  setShowDeleteModal(true);
                }}>
                <Text style={[styles.settingsItemText, { color: '#f44336' }]}>Delete Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      )}
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
            {activeTab === 'posts' ? 'No cars posted yet' : 'No liked cars yet'}
          </Text>
        }
        renderItem={renderGridItem}
      />

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: cardBg }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Delete Account</Text>
            <Text style={[styles.modalBody, { color: subtextColor }]}>
              Are you sure you want to delete your account? All data will be lost.
            </Text>
            <Text style={[styles.modalPrompt, { color: textColor }]}>
              Type "delete account" to confirm:
            </Text>
            <TextInput
              style={[styles.modalInput, {
                backgroundColor: isDarkMode ? '#333' : '#f5f5f5',
                borderColor: isDarkMode ? '#555' : '#e0e0e0',
                color: textColor,
              }]}
              value={deleteInput}
              onChangeText={setDeleteInput}
              placeholder="delete account"
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeleteInput('');
                }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalDeleteButton,
                  deleteInput.toLowerCase() !== 'delete account' && styles.modalDeleteButtonDisabled,
                ]}
                onPress={handleDeleteAccount}
                disabled={deleteInput.toLowerCase() !== 'delete account' || isDeleting}>
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalDeleteText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
  profileCardHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    marginBottom: -8,
  },
  gearSpacer: {
    flex: 1,
  },
  gearButton: {
    padding: 4,
  },
  gearIcon: {
    fontSize: 22,
  },
  settingsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    alignItems: 'flex-end',
  },
  settingsDropdown: {
    marginTop: 52,
    marginRight: 16,
    borderRadius: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    minWidth: 180,
  },
  settingsItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingsItemText: {
    fontSize: 15,
    fontWeight: '500',
  },
  settingsDivider: {
    height: 1,
    marginHorizontal: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalContainer: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  modalPrompt: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalCancelText: {
    fontSize: 15,
    color: '#2196f3',
    fontWeight: '600',
  },
  modalDeleteButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f44336',
  },
  modalDeleteButtonDisabled: {
    backgroundColor: '#ef9a9a',
  },
  modalDeleteText: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '600',
  },
});

export default ProfileScreen;
