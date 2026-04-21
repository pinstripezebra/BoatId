import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';

interface AboutUsScreenProps {
  onClose: () => void;
}

const snapshots = [
  { id: '1', source: require('../assets/images/car1.png'), label: 'Street Coupe' },
  { id: '2', source: require('../assets/images/car2.png'), label: 'Sport Sedan' },
  { id: '3', source: require('../assets/images/car3.png'), label: 'Urban SUV' },
  { id: '4', source: require('../assets/images/car4.png'), label: 'Classic Detail' },
  { id: '5', source: require('../assets/images/car5.png'), label: 'Performance Build' },
  { id: '6', source: require('../assets/images/car2.png'), label: 'Collector Pick' },
];

const AboutUsScreen: React.FC<AboutUsScreenProps> = ({ onClose }) => {
  const isDarkMode = useColorScheme() === 'dark';

  const bgColor = isDarkMode ? '#12161d' : '#f3f6fb';
  const cardBg = isDarkMode ? '#1f2633' : '#ffffff';
  const textColor = isDarkMode ? '#eef2f8' : '#1e2a3a';
  const subtextColor = isDarkMode ? '#b7c1d3' : '#4c5e78';
  const accentColor = '#1d8cf8';

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Text style={[styles.backText, { color: accentColor }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>About CarId</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={[styles.heroCard, { backgroundColor: cardBg }]}> 
          <Text style={[styles.heroTag, { color: accentColor }]}>WHAT WE DO</Text>
          <Text style={[styles.heroTitle, { color: textColor }]}>Find the story behind every car in seconds.</Text>
          <Text style={[styles.heroBody, { color: subtextColor }]}>
            CarId helps drivers, enthusiasts, and curious explorers identify cars from photos, save findings, and discover what is trending nearby.
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: textColor }]}>Services We Offer</Text>
        <View style={[styles.serviceCard, { backgroundColor: cardBg }]}> 
          <Text style={[styles.serviceItem, { color: textColor }]}>• AI-powered car identification from camera snapshots</Text>
          <Text style={[styles.serviceItem, { color: textColor }]}>• Search and browse popular cars from the community</Text>
          <Text style={[styles.serviceItem, { color: textColor }]}>• Save personal identification history for quick revisit</Text>
          <Text style={[styles.serviceItem, { color: textColor }]}>• Like and organize interesting finds across sessions</Text>
          <Text style={[styles.serviceItem, { color: textColor }]}>• View nearby car activity to explore your local scene</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: textColor }]}>Example Snapshots</Text>
        <View style={styles.snapshotGrid}>
          {snapshots.map((snapshot) => (
            <View key={snapshot.id} style={[styles.snapshotCard, { backgroundColor: cardBg }]}> 
              <Image source={snapshot.source} style={styles.snapshotImage} resizeMode="cover" />
              <Text style={[styles.snapshotLabel, { color: subtextColor }]}>{snapshot.label}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.footer, { color: subtextColor }]}>CarId • Identify, explore, and keep the drive inspiring.</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 70,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: 16,
    padding: 18,
    marginTop: 6,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(29, 140, 248, 0.2)',
  },
  heroTag: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 23,
    fontWeight: '700',
    lineHeight: 30,
    marginBottom: 10,
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 4,
  },
  serviceCard: {
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  serviceItem: {
    fontSize: 14,
    lineHeight: 22,
    marginVertical: 3,
  },
  snapshotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  snapshotCard: {
    width: '48.5%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  snapshotImage: {
    width: '100%',
    height: 120,
  },
  snapshotLabel: {
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontWeight: '600',
  },
  footer: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 13,
    fontStyle: 'italic',
  },
});

export default AboutUsScreen;