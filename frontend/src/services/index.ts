export { default as CarApiService } from './carApi';
export { HttpClient } from './httpClient';
export { API_BASE_URL } from '../config/api';

// Export types from carApi
export type {
  CarIdentificationRequest,
  CarDetails,
  CarIdentificationResponse,
  CarIdentificationListResponse,
  SearchResponse,
  NearbyCar,
  NearbyCarsResponse,
  PopularCar,
  PopularCarsResponse,
  LikedCarIdsResponse,
  UserLikedCarsResponse,
  SearchResult,
} from './carApi';