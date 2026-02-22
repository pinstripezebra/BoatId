/**
 * BoatId App Configuration
 * Central configuration file for the application
 */

export const CONFIG = {
  // App Information
  APP_NAME: 'BoatId',
  APP_VERSION: '1.0.0',
  
  // API Configuration (to be updated when backend is integrated)
  API_BASE_URL: 'http://localhost:8000',
  API_ENDPOINTS: {
    AUTH: '/auth',
    BOATS: '/boats',
    USERS: '/users',
    IMAGES: '/images',
  },
  
  // Camera Configuration
  CAMERA: {
    QUALITY: 0.8,
    ASPECT_RATIO: [4, 3] as [number, number],
    FLASH: 'auto' as const,
  },
  
  // Storage Configuration
  STORAGE_KEYS: {
    USER_TOKEN: '@BoatId:userToken',
    USER_DATA: '@BoatId:userData',
    SETTINGS: '@BoatId:settings',
  },
  
  // Theme Colors
  COLORS: {
    primary: '#2196f3',
    secondary: '#1976d2',
    background: '#f8f9fa',
    backgroundDark: '#1a1a1a',
    text: '#333333',
    textDark: '#ffffff',
    card: '#ffffff',
    cardDark: '#2a2a2a',
    border: '#e0e0e0',
    borderDark: '#404040',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
  },
  
  // Feature Flags
  FEATURES: {
    CAMERA_ENABLED: true,
    CLOUD_SYNC: true,
    OFFLINE_MODE: true,
    ANALYTICS: false,
  },
} as const;

export default CONFIG;