import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { API_BASE_URL } from '../config/api';

const TOKEN_KEY = '@CarId:accessToken';
const USER_KEY = '@CarId:userData';
const KEYCHAIN_SERVICE = 'com.carid.refreshtoken';

export interface AuthUser {
  user_id: string;
  username: string;
  role: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user_id: string;
  username: string;
  role: string;
}

export interface RegisterResponse {
  message: string;
  email: string;
}

export class AuthService {
  private static token: string | null = null;
  private static user: AuthUser | null = null;

  static getToken(): string | null {
    return this.token;
  }

  static getUser(): AuthUser | null {
    return this.user;
  }

  static async loadStoredAuth(): Promise<boolean> {
    try {
      // Retrieve refresh token from secure storage
      const credentials = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
      if (!credentials) {
        return false;
      }
      const refreshToken = credentials.password;

      // Use the refresh token to get a new access token
      await this.refreshWithToken(refreshToken);
      return true;
    } catch {
      // Refresh token invalid or expired, clear everything
      await this.logout();
      return false;
    }
  }

  static async login(username: string, password: string): Promise<LoginResponse> {
    const url = `${API_BASE_URL}/auth/login`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 403 && error.email) {
        const err = new Error(error.detail || 'Email not verified');
        (err as any).email = error.email;
        throw err;
      }
      throw new Error(error.detail || 'Login failed');
    }

    const data: LoginResponse = await response.json();

    this.token = data.access_token;
    this.user = {
      user_id: data.user_id,
      username: data.username,
      role: data.role,
    };

    // Store access token and user data in AsyncStorage
    await AsyncStorage.setItem(TOKEN_KEY, data.access_token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(this.user));

    // Store refresh token securely in Keychain
    await Keychain.setGenericPassword('refreshToken', data.refresh_token, {
      service: KEYCHAIN_SERVICE,
    });

    return data;
  }

  static async register(
    username: string,
    password: string,
    email: string,
  ): Promise<RegisterResponse> {
    const url = `${API_BASE_URL}/auth/register`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Registration failed');
    }

    return await response.json();
  }

  static async verifyEmail(email: string, code: string): Promise<LoginResponse> {
    const url = `${API_BASE_URL}/auth/verify-email`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Verification failed');
    }

    const data: LoginResponse = await response.json();

    this.token = data.access_token;
    this.user = {
      user_id: data.user_id,
      username: data.username,
      role: data.role,
    };

    await AsyncStorage.setItem(TOKEN_KEY, data.access_token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(this.user));
    await Keychain.setGenericPassword('refreshToken', data.refresh_token, {
      service: KEYCHAIN_SERVICE,
    });

    return data;
  }

  static async resendVerification(email: string): Promise<void> {
    const url = `${API_BASE_URL}/auth/resend-verification`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Failed to resend code');
    }
  }

  static async refresh(): Promise<void> {
    // Retrieve the refresh token from secure storage and use it
    const credentials = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
    if (!credentials) {
      throw new Error('No refresh token available');
    }
    await this.refreshWithToken(credentials.password);
  }

  private static async refreshWithToken(refreshToken: string): Promise<void> {
    const url = `${API_BASE_URL}/auth/refresh`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) throw new Error('Token refresh failed');

    const data: LoginResponse = await response.json();
    this.token = data.access_token;
    this.user = {
      user_id: data.user_id,
      username: data.username,
      role: data.role,
    };

    // Update stored tokens
    await AsyncStorage.setItem(TOKEN_KEY, data.access_token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(this.user));

    // Store the rotated refresh token securely
    await Keychain.setGenericPassword('refreshToken', data.refresh_token, {
      service: KEYCHAIN_SERVICE,
    });
  }

  static async logout(): Promise<void> {
    // Revoke refresh token on the server
    try {
      const credentials = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
      if (credentials) {
        const url = `${API_BASE_URL}/auth/logout`;
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: credentials.password }),
        });
      }
    } catch {
      // If revocation fails, still proceed with local cleanup
    }

    this.token = null;
    this.user = null;
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
  }

  static async deleteAccount(): Promise<void> {
    const url = `${API_BASE_URL}/api/v1/users/delete-account`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Failed to delete account');
    }

    // Clear local storage after successful deletion
    await this.logout();
  }

  static async forgotPassword(email: string): Promise<void> {
    const url = `${API_BASE_URL}/auth/forgot-password`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Failed to send reset code');
    }
  }

  static async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    const url = `${API_BASE_URL}/auth/reset-password`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, new_password: newPassword }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Failed to reset password');
    }
  }
}

export default AuthService;
