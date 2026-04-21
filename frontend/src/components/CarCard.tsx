import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, useColorScheme, ImageSourcePropType} from 'react-native';
import CachedImage from './CachedImage';

export interface CarCardData {
  id: string;
  name: string;
  image?: ImageSourcePropType;
  type?: string;
  make?: string;
}

interface CarCardProps extends CarCardData {
  onPress?: () => void;
  isLiked?: boolean;
  onLikeToggle?: (id: string) => void;
}

const CarCard: React.FC<CarCardProps> = ({id, name, type, make, image, onPress, isLiked, onLikeToggle}) => {
  const isDarkMode = useColorScheme() === 'dark';

  const cardBg = isDarkMode ? '#2a2a2a' : '#ffffff';
  const textColor = isDarkMode ? '#ffffff' : '#333333';
  const subtextColor = isDarkMode ? '#aaaaaa' : '#666666';

  return (
    <TouchableOpacity
      style={[styles.card, {backgroundColor: cardBg}]}
      onPress={onPress}
      activeOpacity={0.8}>
      <View>
        {image ? (
          <CachedImage source={image} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderEmoji}>�</Text>
          </View>
        )}
        {onLikeToggle && (
          <TouchableOpacity
            style={styles.likeButton}
            onPress={e => {
              e.stopPropagation();
              onLikeToggle(id);
            }}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
            <Text style={styles.likeIcon}>{isLiked ? '♥' : '♡'}</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, {color: textColor}]} numberOfLines={1}>
          {name}
        </Text>
        {(make || type) && (
          <Text style={[styles.subtitle, {color: subtextColor}]} numberOfLines={1}>
            {[make, type].filter(Boolean).join(' · ')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 160,
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  imagePlaceholder: {
    width: '100%',
    height: 100,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: 100,
  },
  likeButton: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeIcon: {
    fontSize: 16,
    color: '#ff4757',
  },
  placeholderEmoji: {
    fontSize: 36,
  },
  info: {
    padding: 10,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});

export default CarCard;
