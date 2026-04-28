import { API_BASE_URL } from '../config/api';
import { AuthService } from './authService';

export class HttpClient {
  private static refreshPromise: Promise<void> | null = null;

  private static async attemptRefresh(): Promise<void> {
    // Coalesce concurrent refresh attempts into a single call
    if (!this.refreshPromise) {
      this.refreshPromise = AuthService.refresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private static async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}/${endpoint.startsWith('/') ? endpoint.slice(1) : endpoint}`;

    // Attach auth token if available
    const token = AuthService.getToken();
    if (token) {
      const headers = new Headers(options.headers);
      headers.set('Authorization', `Bearer ${token}`);
      options.headers = headers;
    }

    let response = await fetch(url, options);

    // On 401, try refreshing the token once and retry
    if (response.status === 401 && token) {
      try {
        await this.attemptRefresh();
        const newToken = AuthService.getToken();
        if (newToken) {
          const retryHeaders = new Headers(options.headers);
          retryHeaders.set('Authorization', `Bearer ${newToken}`);
          options.headers = retryHeaders;
          response = await fetch(url, options);
        }
      } catch {
        // Refresh failed — fall through to the error handler below
      }
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        // Use default error message
      }
      throw new Error(errorMessage);
    }

    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return undefined as unknown as T;
    }

    return await response.json();
  }

  static async get<T>(endpoint: string): Promise<T> {
    return this.makeRequest<T>(endpoint, { method: 'GET' });
  }

  static async post<T>(endpoint: string, body?: any): Promise<T> {
    const options: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    };
    return this.makeRequest<T>(endpoint, options);
  }

  static async uploadFile<T>(endpoint: string, formData: FormData): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: formData
    });
  }

  static async put<T>(endpoint: string, body?: any): Promise<T> {
    const options: RequestInit = {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    };
    return this.makeRequest<T>(endpoint, options);
  }

  static async delete<T>(endpoint: string): Promise<T> {
    return this.makeRequest<T>(endpoint, { method: 'DELETE' });
  }
}