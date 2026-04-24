import React from 'react';
import {View, Text, FlatList, StyleSheet, TouchableOpacity, useColorScheme} from 'react-native';
import CarCard, {type CarCardData} from './CarCard';

interface HorizontalCarListProps {
  title: string;
  cars: CarCardData[];
  onCarPress?: (car: CarCardData) => void;
  maxItems?: number;
  isLiked?: (id: string) => boolean;
  onLikeToggle?: (id: string) => void;
  onHeaderPress?: () => void;
  onViewMorePress?: () => void;
}

const HorizontalCarList: React.FC<HorizontalCarListProps> = ({
  title,
  cars,
  onCarPress,
  maxItems,
  isLiked,
  onLikeToggle,
  onHeaderPress,
  onViewMorePress,
}) => {
  const isDarkMode = useColorScheme() === 'dark';
  const textColor = isDarkMode ? '#ffffff' : '#333333';
  const subtleColor = isDarkMode ? '#aaaaaa' : '#888888';

  const displayCars = maxItems ? cars.slice(0, maxItems) : cars;

  const viewMoreCard = onViewMorePress ? (
    <TouchableOpacity style={styles.viewMoreCard} onPress={onViewMorePress} activeOpacity={0.7}>
      <Text style={styles.viewMoreArrow}>›</Text>
      <Text style={[styles.viewMoreText, {color: subtleColor}]}>View More</Text>
    </TouchableOpacity>
  ) : null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.titleRow}
        onPress={onHeaderPress}
        disabled={!onHeaderPress}
        activeOpacity={onHeaderPress ? 0.6 : 1}>
        <Text style={[styles.title, {color: textColor}]}>{title}</Text>
        {onHeaderPress && <Text style={[styles.titleChevron, {color: subtleColor}]}>›</Text>}
      </TouchableOpacity>
      <FlatList
        data={displayCars}
        keyExtractor={item => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListFooterComponent={viewMoreCard}
        renderItem={({item}) => (
          <CarCard
            {...item}
            onPress={() => onCarPress?.(item)}
            isLiked={isLiked?.(item.id)}
            onLikeToggle={onLikeToggle}
          />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  titleChevron: {
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 4,
    marginTop: 1,
  },
  list: {
    paddingRight: 8,
  },
  viewMoreCard: {
    width: 120,
    height: 200,
    borderRadius: 12,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#cccccc',
    borderStyle: 'dashed',
  },
  viewMoreArrow: {
    fontSize: 32,
    color: '#aaaaaa',
    lineHeight: 36,
  },
  viewMoreText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
});

export default HorizontalCarList;
