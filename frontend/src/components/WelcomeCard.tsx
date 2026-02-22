import React from 'react';
import {View, Text, StyleSheet, useColorScheme} from 'react-native';

interface WelcomeCardProps {
  title: string;
  description: string;
}

const WelcomeCard: React.FC<WelcomeCardProps> = ({title, description}) => {
  const isDarkMode = useColorScheme() === 'dark';
  
  const textStyle = {
    color: isDarkMode ? '#ffffff' : '#424242',
  };

  return (
    <View style={styles.welcomeCard}>
      <Text style={[styles.welcomeText, {color: '#1976d2'}]}>
        {title}
      </Text>
      <Text style={[styles.descriptionText, textStyle]}>
        {description}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  welcomeCard: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
  },
});

export default WelcomeCard;