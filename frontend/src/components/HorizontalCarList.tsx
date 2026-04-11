import React from 'react';
import {View, Text, FlatList, StyleSheet, useColorScheme} from 'react-native';
import CarCard, {type CarCardData} from './CarCard';

interface HorizontalCarListProps {
  title: string;
  cars: CarCardData[];
  onCarPress?: (car: CarCardData) => void;
  maxItems?: number;
  isLiked?: (id: string) => boolean;
  onLikeToggle?: (id: string) => void;
}

const HorizontalCarList: React.FC<HorizontalCarListProps> = ({
  title,
  cars,
  onCarPress,
  maxItems,
  isLiked,
  onLikeToggle,
}) => {
  const isDarkMode = useColorScheme() === 'dark';
  const textColor = isDarkMode ? '#ffffff' : '#333333';

  const displayCars = maxItems ? cars.slice(0, maxItems) : cars;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, {color: textColor}]}>{title}</Text>
      <FlatList
        data={displayCars}
        keyExtractor={item => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
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
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  list: {
    paddingRight: 8,
  },
});

export default HorizontalCarList;
