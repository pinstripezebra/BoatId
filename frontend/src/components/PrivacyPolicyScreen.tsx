import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';

interface PrivacyPolicyScreenProps {
  onClose: () => void;
}

const PrivacyPolicyScreen: React.FC<PrivacyPolicyScreenProps> = ({ onClose }) => {
  const isDarkMode = useColorScheme() === 'dark';

  const bgColor = isDarkMode ? '#1a1a1a' : '#f8f9fa';
  const textColor = isDarkMode ? '#ffffff' : '#333333';
  const subtextColor = isDarkMode ? '#aaaaaa' : '#666666';

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>Privacy Policy</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}>

        <Text style={[styles.lastUpdated, { color: subtextColor }]}>
          Last updated: April 10, 2026
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>1. Introduction</Text>
        <Text style={[styles.body, { color: textColor }]}>
          BoatId Inc. ("we", "our", or "us") operates the BoatID mobile application (the "App"). This Privacy Policy explains how we collect, use, store, and protect your personal information when you use our App.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>2. Information We Collect</Text>
        <Text style={[styles.body, { color: textColor }]}>
          We collect the following types of information:
        </Text>
        <Text style={[styles.body, { color: textColor }]}>
          {'\u2022'} Account Information: Username, email address, and encrypted password when you create an account.{'\n'}
          {'\u2022'} Photos: Images you capture or upload for boat identification. These are stored on our servers for processing and retrieval.{'\n'}
          {'\u2022'} Location Data: GPS coordinates when you use the camera or map features, used to tag boat sighting locations.{'\n'}
          {'\u2022'} Usage Data: Information about how you interact with the App, including boats you identify and like.{'\n'}
          {'\u2022'} Optional Profile Information: Phone number, location description, and bio if you choose to provide them.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>3. How We Use Your Information</Text>
        <Text style={[styles.body, { color: textColor }]}>
          We use your information to:{'\n\n'}
          {'\u2022'} Provide boat identification services using AI image analysis{'\n'}
          {'\u2022'} Store and display your identification history{'\n'}
          {'\u2022'} Enable social features such as liking and viewing popular boats{'\n'}
          {'\u2022'} Authenticate your account and maintain security{'\n'}
          {'\u2022'} Improve our boat identification accuracy and App experience
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>4. Data Storage & Security</Text>
        <Text style={[styles.body, { color: textColor }]}>
          Your data is stored securely using Amazon Web Services (AWS) infrastructure, including:{'\n\n'}
          {'\u2022'} Images are stored in AWS S3 with private access controls{'\n'}
          {'\u2022'} Account data is stored in a PostgreSQL database hosted on AWS RDS{'\n'}
          {'\u2022'} Passwords are hashed using bcrypt and are never stored in plain text{'\n'}
          {'\u2022'} Authentication uses JWT tokens with secure refresh token rotation{'\n'}
          {'\u2022'} All communication between the App and our servers is encrypted
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>5. Third-Party Services</Text>
        <Text style={[styles.body, { color: textColor }]}>
          We use the following third-party services to operate the App:{'\n\n'}
          {'\u2022'} Amazon Web Services (AWS): Cloud infrastructure, image storage, and database hosting{'\n'}
          {'\u2022'} Anthropic: AI-powered boat image analysis (images are sent to their API for identification){'\n\n'}
          We do not sell, rent, or share your personal information with third parties for marketing purposes.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>6. Data Retention</Text>
        <Text style={[styles.body, { color: textColor }]}>
          We retain your data for as long as your account is active. You may request deletion of your account and all associated data at any time through the App settings.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>7. Your Rights</Text>
        <Text style={[styles.body, { color: textColor }]}>
          You have the right to:{'\n\n'}
          {'\u2022'} Access your personal data through your profile and identification history{'\n'}
          {'\u2022'} Delete your account and all associated data at any time via the settings menu{'\n'}
          {'\u2022'} Update or correct your profile information{'\n'}
          {'\u2022'} Withdraw consent by deleting your account
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>8. Children's Privacy</Text>
        <Text style={[styles.body, { color: textColor }]}>
          The App is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>9. Changes to This Policy</Text>
        <Text style={[styles.body, { color: textColor }]}>
          We may update this Privacy Policy from time to time. We will notify you of any significant changes through the App. Continued use of the App after changes constitutes acceptance of the updated policy.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>10. Contact Us</Text>
        <Text style={[styles.body, { color: textColor }]}>
          If you have questions about this Privacy Policy or your data, please contact us at:{'\n\n'}
          BoatId Inc.{'\n'}
          Email: privacy@boatid.com
        </Text>

        <View style={styles.bottomSpacer} />
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
    color: '#2196f3',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  lastUpdated: {
    fontSize: 13,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  bottomSpacer: {
    height: 20,
  },
});

export default PrivacyPolicyScreen;
