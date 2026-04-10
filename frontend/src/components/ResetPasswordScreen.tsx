import React, { useState, useRef, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { AuthService } from '../services/authService';

interface ResetPasswordScreenProps {
  email: string;
  onResetSuccess: () => void;
  onBack: () => void;
}

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({ email, onResetSuccess, onBack }) => {
  const isDarkMode = useColorScheme() === 'dark';
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const textColor = isDarkMode ? '#ffffff' : '#333333';
  const bgColor = isDarkMode ? '#1a1a1a' : '#f8f9fa';
  const cardBg = isDarkMode ? '#2a2a2a' : '#ffffff';
  const inputBg = isDarkMode ? '#333333' : '#f5f5f5';
  const inputBorder = isDarkMode ? '#555555' : '#e0e0e0';
  const subtextColor = isDarkMode ? '#aaaaaa' : '#666666';

  const passwordRequirements = [
    { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
    { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
    { label: 'One number', test: (p: string) => /[0-9]/.test(p) },
    { label: 'One special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
  ];
  const allRequirementsMet = newPassword.length > 0 && passwordRequirements.every(r => r.test(newPassword));

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleDigitChange = useCallback((text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [code]);

  const handleKeyPress = useCallback((key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
    }
  }, [code]);

  const fullCode = code.join('');
  const isCodeComplete = fullCode.length === CODE_LENGTH;

  const handleReset = async () => {
    if (!isCodeComplete || !allRequirementsMet) return;
    setIsLoading(true);
    try {
      await AuthService.resetPassword(email, fullCode, newPassword);
      Alert.alert('Success', 'Your password has been reset. Please sign in with your new password.', [
        { text: 'OK', onPress: onResetSuccess },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Reset failed';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    try {
      await AuthService.forgotPassword(email);
      setResendTimer(RESEND_COOLDOWN);
      Alert.alert('Code Sent', 'A new reset code has been sent to your email.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resend code';
      Alert.alert('Error', message);
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
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.title, { color: textColor }]}>Reset Password</Text>
          <Text style={[styles.subtitle, { color: subtextColor }]}>
            Enter the 6-digit code sent to
          </Text>
          <Text style={[styles.email, { color: textColor }]}>{email}</Text>

          <View style={styles.codeContainer}>
            {Array.from({ length: CODE_LENGTH }).map((_, i) => (
              <TextInput
                key={i}
                ref={ref => { inputRefs.current[i] = ref; }}
                style={[
                  styles.codeInput,
                  { backgroundColor: inputBg, borderColor: code[i] ? '#2196f3' : inputBorder, color: textColor },
                ]}
                value={code[i]}
                onChangeText={text => handleDigitChange(text, i)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                autoFocus={i === 0}
              />
            ))}
          </View>

          <TextInput
            style={[styles.passwordInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
            placeholder="New Password"
            placeholderTextColor={isDarkMode ? '#888' : '#999'}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />

          {newPassword.length > 0 && (
            <View style={styles.requirementsList}>
              {passwordRequirements.map((req, i) => (
                <Text key={i} style={[
                  styles.requirementItem,
                  { color: req.test(newPassword) ? '#4CAF50' : '#F44336' },
                ]}>
                  {req.test(newPassword) ? '✓' : '✗'} {req.label}
                </Text>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.resetButton, (!isCodeComplete || !allRequirementsMet || isLoading) && styles.disabledButton]}
            onPress={handleReset}
            disabled={!isCodeComplete || !allRequirementsMet || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.resetButtonText}>Reset Password</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResend}
            disabled={resendTimer > 0}
          >
            <Text style={[styles.resendText, { color: resendTimer > 0 ? subtextColor : '#2196f3' }]}>
              {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend Code'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={[styles.backText, { color: '#2196f3' }]}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  card: {
    borderRadius: 16,
    padding: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  email: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  codeInput: {
    width: 44,
    height: 52,
    borderWidth: 2,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: 'bold',
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  requirementsList: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  requirementItem: {
    fontSize: 12,
    marginBottom: 2,
  },
  resetButton: {
    backgroundColor: '#2196f3',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#90CAF9',
  },
  resetButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
  },
  backButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  backText: {
    fontSize: 14,
  },
});

export default ResetPasswordScreen;
