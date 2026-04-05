import React from 'react';
import {View, Text, Image, TouchableOpacity, StyleSheet, useColorScheme, ImageSourcePropType} from 'react-native';

export interface BoatCardData {
  id: string;
  name: string;
  image?: ImageSourcePropType;
  type?: string;
  make?: string;
}

interface BoatCardProps extends BoatCardData {
  onPress?: () => void;
}

const BoatCard: React.FC<BoatCardProps> = ({name, type, make, image, onPress}) => {
  const isDarkMode = useColorScheme() === 'dark';

  const cardBg = isDarkMode ? '#2a2a2a' : '#ffffff';
  const textColor = isDarkMode ? '#ffffff' : '#333333';
  const subtextColor = isDarkMode ? '#aaaaaa' : '#666666';

  return (
    <TouchableOpacity
      style={[styles.card, {backgroundColor: cardBg}]}
      onPress={onPress}
      activeOpacity={0.8}>
      {image ? (
        <Image source={image} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.placeholderEmoji}>🚤</Text>
        </View>
      )}
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

export default BoatCard;
