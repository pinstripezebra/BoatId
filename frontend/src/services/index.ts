export { default as BoatApiService } from './boatApi';
export { HttpClient } from './httpClient';
export { API_BASE_URL } from '../config/api';

// Export types from boatApi
export type {
  BoatIdentificationRequest,
  BoatDetails,
  BoatIdentificationResponse,
  BoatIdentificationListResponse,
  SearchResponse,
} from './boatApi';