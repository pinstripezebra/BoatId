import React from 'react';
import {View, Text, FlatList, StyleSheet, useColorScheme} from 'react-native';
import BoatCard, {type BoatCardData} from './BoatCard';

interface HorizontalBoatListProps {
  title: string;
  boats: BoatCardData[];
  onBoatPress?: (boat: BoatCardData) => void;
}

const HorizontalBoatList: React.FC<HorizontalBoatListProps> = ({
  title,
  boats,
  onBoatPress,
}) => {
  const isDarkMode = useColorScheme() === 'dark';
  const textColor = isDarkMode ? '#ffffff' : '#333333';

  return (
    <View style={styles.container}>
      <Text style={[styles.title, {color: textColor}]}>{title}</Text>
      <FlatList
        data={boats}
        keyExtractor={item => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({item}) => (
          <BoatCard {...item} onPress={() => onBoatPress?.(item)} />
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

export default HorizontalBoatList;
