import React, { useState, useRef, useCallback } from 'react';
import {View, TextInput, StyleSheet, useColorScheme} from 'react-native';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const isDarkMode = useColorScheme() === 'dark';
  const [text, setText] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bgColor = isDarkMode ? '#333333' : '#f0f0f0';
  const textColor = isDarkMode ? '#ffffff' : '#333333';
  const placeholderColor = isDarkMode ? '#888888' : '#999999';

  const handleChangeText = useCallback((value: string) => {
    setText(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        onSearch(trimmed);
      }
    }, 500);
  }, [onSearch]);

  const handleSubmit = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    const trimmed = text.trim();
    if (trimmed.length > 0) {
      onSearch(trimmed);
    }
  }, [text, onSearch]);

  return (
    <View style={[styles.container, {backgroundColor: bgColor}]}>
      <TextInput
        style={[styles.input, {color: textColor}]}
        placeholder="🔍  Search boats..."
        placeholderTextColor={placeholderColor}
        value={text}
        onChangeText={handleChangeText}
        onSubmitEditing={handleSubmit}
        returnKeyType="search"
        autoCorrect={false}
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
