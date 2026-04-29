import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Image,
  ScrollView,
} from 'react-native';

interface WelcomeModalProps {
  visible: boolean;
  onSignUp: () => void;
  onLogin: () => void;
  onDismiss: () => void;
}

const FEATURES = [
  {
    image: require('../assets/images/car1.png'),
    title: 'Identify Any Car',
    description: 'Point your camera at any car to instantly identify its make, model, and year.',
  },
  {
    image: require('../assets/images/car2.png'),
    title: 'Explore Nearby',
    description: 'Browse cars spotted near you on an interactive map.',
  },
  {
    image: require('../assets/images/car3.png'),
    title: 'Car Statistics',
    description: 'Get detailed specs and stats for any vehicle including MPG, engine info, and more.',
  },
  {
    image: require('../assets/images/car4.png'),
    title: 'Like & Discover',
    description: 'Like your favourite cars and explore what's popular in the community.',
  },
];

const WelcomeModal: React.FC<WelcomeModalProps> = ({ visible, onSignUp, onLogin, onDismiss }) => {
  const isDarkMode = useColorScheme() === 'dark';

  const bgColor = isDarkMode ? '#1a1a1a' : '#ffffff';
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a';
  const subtextColor = isDarkMode ? '#aaaaaa' : '#555555';
  const dividerColor = isDarkMode ? '#333333' : '#e0e0e0';

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        {/* X dismiss button */}
        <TouchableOpacity style={styles.closeButton} onPress={onDismiss}>
          <Text style={[styles.closeIcon, { color: subtextColor }]}>✕</Text>
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <Text style={[styles.title, { color: textColor }]}>🚗 CarID</Text>
          <Text style={[styles.subtitle, { color: subtextColor }]}>
            Car Identification Made Simple
          </Text>

          {/* CTA buttons */}
          <TouchableOpacity style={styles.signUpButton} onPress={onSignUp}>
            <Text style={styles.signUpText}>Create Account</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.loginButton, { borderColor: dividerColor }]} onPress={onLogin}>
            <Text style={[styles.loginText, { color: textColor }]}>Sign In</Text>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: dividerColor }]} />

          <Text style={[styles.featuresHeader, { color: textColor }]}>What you can do with CarID</Text>

          {/* Feature list */}
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Image source={f.image} style={styles.featureImage} resizeMode="cover" />
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: textColor }]}>{f.title}</Text>
                <Text style={[styles.featureDesc, { color: subtextColor }]}>{f.description}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  closeIcon: {
    fontSize: 20,
    fontWeight: '600',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  signUpButton: {
    backgroundColor: '#2196f3',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  signUpText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loginButton: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 28,
  },
  loginText: {
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginBottom: 24,
  },
  featuresHeader: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  featureImage: {
    width: 72,
    height: 54,
    borderRadius: 8,
    flexShrink: 0,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
});

export default WelcomeModal;
