import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { AuthService } from '../services/authService';
import { BoatApiService, type BoatIdentificationListResponse } from '../services';

interface ProfileScreenProps {
  onViewAllBoats: () => void;
}

interface BoatStats {
  total: number;
  byType: Record<string, number>;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ onViewAllBoats }) => {
  const isDarkMode = useColorScheme() === 'dark';
  const [stats, setStats] = useState<BoatStats>({ total: 0, byType: {} });
  const [isLoading, setIsLoading] = useState(true);

  const bgColor = isDarkMode ? '#1a1a1a' : '#f8f9fa';
  const cardBg = isDarkMode ? '#2a2a2a' : '#ffffff';
  const textColor = isDarkMode ? '#ffffff' : '#333333';
  const subtextColor = isDarkMode ? '#aaaaaa' : '#666666';
  const dividerColor = isDarkMode ? '#333333' : '#e0e0e0';

  const user = AuthService.getUser();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      // Fetch all identifications to compute stats
      const data = await BoatApiService.getIdentifications(1, 100, { isBoat: true });
      const byType: Record<string, number> = {};
      for (const item of data.results) {
        const boatType = item.identification_data?.boat_type || 'Unknown';
        byType[boatType] = (byType[boatType] || 0) + 1;
      }
      setStats({ total: data.total_count, byType });
    } catch (error) {
      console.error('Failed to load boat stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sortedTypes = Object.entries(stats.byType).sort((a, b) => b[1] - a[1]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: bgColor }]} contentContainerStyle={styles.content}>
      {/* Avatar & Name */}
      <View style={[styles.profileCard, { backgroundColor: cardBg }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.username ? user.username.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>
        <Text style={[styles.username, { color: textColor }]}>{user?.username || 'Unknown'}</Text>
        <Text style={[styles.role, { color: subtextColor }]}>{user?.role || 'user'}</Text>
      </View>

      {/* Stats */}
      <View style={[styles.statsCard, { backgroundColor: cardBg }]}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>Boat Stats</Text>
        <View style={[styles.divider, { backgroundColor: dividerColor }]} />

        {isLoading ? (
          <ActivityIndicator size="small" color="#2196f3" style={styles.loader} />
        ) : (
          <>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: subtextColor }]}>Total Boats Identified</Text>
              <Text style={[styles.totalValue, { color: textColor }]}>{stats.total}</Text>
            </View>

            {sortedTypes.length > 0 && (
              <>
                <View style={[styles.divider, { backgroundColor: dividerColor }]} />
                <Text style={[styles.breakdownTitle, { color: subtextColor }]}>By Type</Text>
                {sortedTypes.map(([type, count]) => (
                  <View key={type} style={styles.typeRow}>
                    <Text style={[styles.typeLabel, { color: textColor }]}>{type}</Text>
                    <Text style={[styles.typeCount, { color: subtextColor }]}>{count}</Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </View>

      {/* View All Boats Button */}
      <TouchableOpacity style={styles.viewAllButton} onPress={onViewAllBoats} activeOpacity={0.8}>
        <Text style={styles.viewAllText}>View All Boats</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  statsCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  loader: {
    marginVertical: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 15,
  },
  totalValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  typeLabel: {
    fontSize: 15,
  },
  typeCount: {
    fontSize: 15,
    fontWeight: '600',
  },
  viewAllButton: {
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#2196f3',
    alignItems: 'center',
    marginTop: 4,
  },
  viewAllText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileScreen;
