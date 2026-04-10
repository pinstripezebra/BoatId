import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useColorScheme,
  Modal,
} from 'react-native';
import { AuthService } from '../services/authService';
import PrivacyPolicyScreen from './PrivacyPolicyScreen';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const isDarkMode = useColorScheme() === 'dark';
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  const passwordRequirements = [
    { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
    { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
    { label: 'One number', test: (p: string) => /[0-9]/.test(p) },
    { label: 'One special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
  ];
  const allRequirementsMet = password.length > 0 && passwordRequirements.every(r => r.test(password));

  const textColor = isDarkMode ? '#ffffff' : '#333333';
  const bgColor = isDarkMode ? '#1a1a1a' : '#f8f9fa';
  const cardBg = isDarkMode ? '#2a2a2a' : '#ffffff';
  const inputBg = isDarkMode ? '#333333' : '#f5f5f5';
  const inputBorder = isDarkMode ? '#555555' : '#e0e0e0';
  const subtextColor = isDarkMode ? '#aaaaaa' : '#666666';

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    if (!isLogin && !email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    setIsLoading(true);
    try {
      if (isLogin) {
        await AuthService.login(username.trim(), password);
        onLoginSuccess();
      } else {
        await AuthService.register(username.trim(), password, email.trim());
        // Auto-login after registration
        await AuthService.login(username.trim(), password);
        onLoginSuccess();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: bgColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.appTitle, { color: textColor }]}>⚓ BoatID</Text>
        <Text style={[styles.appSubtitle, { color: textColor }]}>
          Boat Identification Made Simple
        </Text>

        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>
            {isLogin ? 'Sign In' : 'Create Account'}
          </Text>

          <TextInput
            style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
            placeholder="Username"
            placeholderTextColor={isDarkMode ? '#888' : '#999'}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {!isLogin && (
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
              placeholder="Email"
              placeholderTextColor={isDarkMode ? '#888' : '#999'}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          )}

          <TextInput
            style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
            placeholder="Password"
            placeholderTextColor={isDarkMode ? '#888' : '#999'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {!isLogin && password.length > 0 && (
            <View style={styles.requirementsList}>
              {passwordRequirements.map((req, i) => (
                <Text key={i} style={[
                  styles.requirementItem,
                  { color: req.test(password) ? '#4CAF50' : '#F44336' },
                ]}>
                  {req.test(password) ? '✓' : '✗'} {req.label}
                </Text>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitButton, (isLoading || (!isLogin && !allRequirementsMet)) && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={isLoading || (!isLogin && !allRequirementsMet)}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isLogin ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          {!isLogin && (
            <Text style={[styles.privacyText, { color: subtextColor }]}>
              By registering, you agree to our{' '}
              <Text
                style={styles.privacyLink}
                onPress={() => setShowPrivacyPolicy(true)}>
                Privacy Policy
              </Text>
            </Text>
          )}

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => {
              setIsLogin(!isLogin);
              setEmail('');
            }}
          >
            <Text style={styles.switchButtonText}>
              {isLogin
                ? "Don't have an account? Sign Up"
                : 'Already have an account? Sign In'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showPrivacyPolicy} animationType="slide">
        <PrivacyPolicyScreen onClose={() => setShowPrivacyPolicy(false)} />
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  appTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  appSubtitle: {
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 40,
  },
  card: {
    borderRadius: 16,
    padding: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#2196f3',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    backgroundColor: '#90CAF9',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchButtonText: {
    color: '#2196f3',
    fontSize: 14,
  },
  requirementsList: {
    marginBottom: 8,
  },
  requirementItem: {
    fontSize: 12,
    marginBottom: 2,
  },
  privacyText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  privacyLink: {
    color: '#2196f3',
    textDecorationLine: 'underline',
  },
});

export default LoginScreen;
