import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Animated,
  Dimensions,
} from 'react-native';
import CachedImage from './CachedImage';
import type { NewlyAwardedBadge } from '../services/carApi';

interface BadgeEarnedModalProps {
  badges: NewlyAwardedBadge[];
  onClose: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BadgeEarnedModal: React.FC<BadgeEarnedModalProps> = ({ badges, onClose }) => {
  const isDarkMode = useColorScheme() === 'dark';
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const badge = badges[currentIndex];

  useEffect(() => {
    // Reset and run entrance animation whenever the badge changes
    scaleAnim.setValue(0.5);
    opacityAnim.setValue(0);

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 80,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulsing glow loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [currentIndex]);

  const handleNext = () => {
    if (currentIndex < badges.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      onClose();
    }
  };

  const bgColor = isDarkMode ? '#1a1a1a' : '#ffffff';
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a';
  const subtextColor = isDarkMode ? '#bbbbbb' : '#555555';

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.85] });
  const isLast = currentIndex === badges.length - 1;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            { backgroundColor: bgColor, opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Stars decoration */}
          <Text style={styles.stars}>✨ 🏆 ✨</Text>

          <Text style={[styles.title, { color: textColor }]}>Badge Unlocked!</Text>

          {/* Badge image with glow ring */}
          <View style={styles.badgeWrapper}>
            <Animated.View style={[styles.glowRing, { opacity: glowOpacity }]} />
            <View style={styles.badgeImageContainer}>
              {badge.image_url ? (
                <CachedImage
                  source={{ uri: badge.image_url }}
                  style={styles.badgeImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.badgeFallback}>⭐</Text>
              )}
            </View>
          </View>

          <Text style={[styles.badgeName, { color: textColor }]}>{badge.name}</Text>
          <Text style={[styles.milestone, { color: '#f5a623' }]}>
            {badge.required_images} {badge.required_images === 1 ? 'car' : 'cars'} identified
          </Text>

          <Text style={[styles.encouragement, { color: subtextColor }]}>
            You're on a roll! Keep snapping cars to unlock even more badges.
          </Text>

          {badges.length > 1 && (
            <Text style={[styles.counter, { color: subtextColor }]}>
              {currentIndex + 1} of {badges.length}
            </Text>
          )}

          <TouchableOpacity style={styles.ctaButton} onPress={handleNext} activeOpacity={0.85}>
            <Text style={styles.ctaText}>
              {isLast ? 'Keep Going! 🚗' : 'Next Badge →'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  container: {
    width: Math.min(SCREEN_WIDTH - 48, 360),
    borderRadius: 24,
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  stars: {
    fontSize: 28,
    marginBottom: 8,
    letterSpacing: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  badgeWrapper: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  glowRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#f5a623',
  },
  badgeImageContainer: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#fff8ec',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  badgeImage: {
    width: 88,
    height: 88,
  },
  badgeFallback: {
    fontSize: 52,
  },
  badgeName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  milestone: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  encouragement: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  counter: {
    fontSize: 13,
    marginBottom: 8,
  },
  ctaButton: {
    marginTop: 20,
    backgroundColor: '#f5a623',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default BadgeEarnedModal;
