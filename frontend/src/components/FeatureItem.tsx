import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, useColorScheme} from 'react-native';

interface FeatureItemProps {
  icon: string;
  title: string;
  onPress?: () => void;
}

const FeatureItem: React.FC<FeatureItemProps> = ({icon, title, onPress}) => {
  const isDarkMode = useColorScheme() === 'dark';
  
  const textStyle = {
    color: isDarkMode ? '#ffffff' : '#333333',
  };

  const cardStyle = {
    backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5',
    borderColor: isDarkMode ? '#404040' : '#e0e0e0',
  };

  return (
    <TouchableOpacity 
      style={[styles.featureItem, cardStyle]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={[styles.featureText, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  featureText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default FeatureItem;