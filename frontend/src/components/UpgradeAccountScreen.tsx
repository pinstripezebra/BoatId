import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { AuthService } from '../services/authService';

interface UpgradeAccountScreenProps {
  onClose: () => void;
  onUpgraded?: () => void;
}

const PREMIUM_FEATURES = [
  '🚗  Unlimited car identifications per week',
  '📊  Full car statistics & specs',
  '❤️   Like and save cars to your profile',
  '🗺️   Explore cars near you on the map',
  '🔍  Search the full car database',
];

const UpgradeAccountScreen: React.FC<UpgradeAccountScreenProps> = ({ onClose, onUpgraded }) => {
  const isDarkMode = useColorScheme() === 'dark';
  const [isLoading, setIsLoading] = useState(false);

  const bgColor = isDarkMode ? '#1a1a1a' : '#f8f9fa';
  const cardBg = isDarkMode ? '#2a2a2a' : '#ffffff';
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a';
  const subtextColor = isDarkMode ? '#aaaaaa' : '#555555';

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await AuthService.upgradeAccount();
      Alert.alert('Upgraded!', 'Your account has been upgraded to Premium.', [
        { text: 'OK', onPress: () => { onUpgraded?.(); onClose(); } },
      ]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Back */}
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Text style={[styles.backText, { color: '#2196f3' }]}>← Back</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: textColor }]}>Upgrade to Premium</Text>
        <Text style={[styles.subtitle, { color: subtextColor }]}>
          Get unlimited access to all CarID features.
        </Text>

        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>Premium includes:</Text>
          {PREMIUM_FEATURES.map((f, i) => (
            <Text key={i} style={[styles.featureItem, { color: subtextColor }]}>{f}</Text>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.placeholderNote, { color: subtextColor }]}>
            💳  Payment processing coming soon. Tap Confirm to upgrade your account.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.confirmButton, isLoading && styles.disabledButton]}
          onPress={handleConfirm}
          disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.confirmText}>Confirm Upgrade</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  backButton: {
    marginBottom: 24,
  },
  backText: {
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 24,
  },
  card: {
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  featureItem: {
    fontSize: 14,
    lineHeight: 22,
  },
  placeholderNote: {
    fontSize: 14,
    lineHeight: 20,
  },
  confirmButton: {
    backgroundColor: '#2196f3',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  confirmText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default UpgradeAccountScreen;
