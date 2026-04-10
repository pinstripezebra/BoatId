import React from 'react';
import {View, Text, StyleSheet, useColorScheme, TouchableOpacity} from 'react-native';

interface SearchBarProps {
  onPress?: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onPress }) => {
  const isDarkMode = useColorScheme() === 'dark';

  const bgColor = isDarkMode ? '#333333' : '#f0f0f0';
  const placeholderColor = isDarkMode ? '#888888' : '#999999';

  return (
    <TouchableOpacity
      style={[styles.container, {backgroundColor: bgColor}]}
      onPress={onPress}
      activeOpacity={0.7}>
      <Text style={[styles.placeholder, {color: placeholderColor}]}>
        🔍  Search boats...
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  placeholder: {
    fontSize: 16,
  },
});

export default SearchBar;
