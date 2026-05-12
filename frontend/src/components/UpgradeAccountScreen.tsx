import React, { useState, useEffect } from 'react';
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
import type { PurchasesPackage } from 'react-native-purchases';
import { SubscriptionService } from '../services/subscriptionService';
import { AuthService } from '../services/authService';

interface UpgradeAccountScreenProps {
  onClose: () => void;
  onUpgraded?: () => void;
}

const PREMIUM_FEATURES = [
  '🚗  Unlimited car identifications',
  '📊  Full car statistics & specs',
  '❤️   Like and save cars to your profile',
  '🗺️   Explore cars near you on the map',
  '🔍  Search the full car database',
];

const UpgradeAccountScreen: React.FC<UpgradeAccountScreenProps> = ({ onClose, onUpgraded }) => {
  const isDarkMode = useColorScheme() === 'dark';
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [offeringsLoading, setOfferingsLoading] = useState(true);

  const bgColor = isDarkMode ? '#1a1a1a' : '#f8f9fa';
  const cardBg = isDarkMode ? '#2a2a2a' : '#ffffff';
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a';
  const subtextColor = isDarkMode ? '#aaaaaa' : '#555555';

  useEffect(() => {
    SubscriptionService.getOfferings().then(p => {
      setPkg(p);
      setOfferingsLoading(false);
    });
  }, []);

  const handlePurchase = async () => {
    if (!pkg) return;
    setIsLoading(true);
    try {
      const customerInfo = await SubscriptionService.purchasePackage(pkg);
      if (SubscriptionService.isEntitlementActive(customerInfo)) {
        AuthService.setUserType('premium');
        Alert.alert(
          'Welcome to CarId Pro!',
          'Your 7-day free trial has started. Enjoy unlimited identifications.',
          [{ text: "Let's go!", onPress: () => { onUpgraded?.(); onClose(); } }],
        );
      }
    } catch (error: any) {
      if (error?.userCancelled) return;
      Alert.alert('Purchase Failed', error?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const customerInfo = await SubscriptionService.restorePurchases();
      if (SubscriptionService.isEntitlementActive(customerInfo)) {
        AuthService.setUserType('premium');
        Alert.alert(
          'Purchases Restored',
          'Your CarId Pro subscription has been restored.',
          [{ text: 'OK', onPress: () => { onUpgraded?.(); onClose(); } }],
        );
      } else {
        Alert.alert('No Active Subscription', 'No previous CarId Pro subscription was found.');
      }
    } catch {
      Alert.alert('Restore Failed', 'Unable to restore purchases. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  };

  const priceString = pkg?.product.priceString ?? '$3.99';

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Back */}
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Text style={[styles.backText, { color: '#2196f3' }]}>← Back</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: textColor }]}>CarId Pro</Text>
        <Text style={[styles.subtitle, { color: subtextColor }]}>
          7 days free, then {priceString}/month. Cancel anytime.
        </Text>

        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>Everything included:</Text>
          {PREMIUM_FEATURES.map((f, i) => (
            <Text key={i} style={[styles.featureItem, { color: subtextColor }]}>{f}</Text>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.confirmButton, (isLoading || offeringsLoading || !pkg) && styles.disabledButton]}
          onPress={handlePurchase}
          disabled={isLoading || offeringsLoading || !pkg}>
          {isLoading || offeringsLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.confirmText}>Start Free Trial</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={isRestoring}>
          {isRestoring ? (
            <ActivityIndicator color="#2196f3" size="small" />
          ) : (
            <Text style={[styles.restoreText, { color: '#2196f3' }]}>Restore Purchases</Text>
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
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  restoreText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default UpgradeAccountScreen;
