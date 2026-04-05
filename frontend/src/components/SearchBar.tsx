import React from 'react';
import {View, TextInput, StyleSheet, useColorScheme} from 'react-native';

const SearchBar: React.FC = () => {
  const isDarkMode = useColorScheme() === 'dark';

  const bgColor = isDarkMode ? '#333333' : '#f0f0f0';
  const textColor = isDarkMode ? '#ffffff' : '#333333';
  const placeholderColor = isDarkMode ? '#888888' : '#999999';

  return (
    <View style={[styles.container, {backgroundColor: bgColor}]}>
      <TextInput
        style={[styles.input, {color: textColor}]}
        placeholder="🔍  Search boats..."
        placeholderTextColor={placeholderColor}
        editable={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    marginBottom: 20,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
});

export default SearchBar;
