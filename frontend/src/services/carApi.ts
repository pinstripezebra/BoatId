import { HttpClient } from './httpClient';

export interface CarIdentificationRequest {
  image: File | Blob;
  requestedFields?: string[];
  storeResults?: boolean;
}

export interface CarDetails {
  make?: string;
  model?: string;
  description?: string;
  year?: string;
  length?: string;
  car_type?: string;
  body_type?: string;
  features?: string[];
}

export interface CarStatistics {
  make?: string;
  model?: string;
  car_class?: string | null;
  cylinders?: number | null;
  displacement?: number | null;
  drive?: string | null;
  fuel_type?: string | null;
  transmission?: string | null;
  city_mpg?: string | null;
  highway_mpg?: string | null;
  combination_mpg?: string | null;
}

export interface CarIdentificationResponse {
  success: boolean;
  identification_id?: number;
  image_url?: string;
  filename: string;
  is_car: boolean;
  car_details?: CarDetails;
  car_statistics?: CarStatistics;
  confidence?: string;
  message?: string;
}

export interface CarIdentificationListResponse {
  results: Array<{
    id: number;
    image_url: string;
    filename: string;
    created_at: string;
    identification_data: CarDetails & {
      is_car: boolean;
      confidence: string;
    };
    is_car: boolean;
  }>;
  total_count: number;
  page_size: number;
  offset: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface SearchResult {
  id: number;
  image_url: string;
  make: string | null;
  model: string | null;
  car_type: string | null;
  year_estimate: string | null;
  confidence: string | null;
  identification_data: CarDetails & {
    is_car: boolean;
    confidence: string;
  };
  likes: number;
  relevance_score: number;
  is_liked: boolean;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total_count: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface NearbyCar {
  id: number;
  latitude: number;
  longitude: number;
  make: string | null;
  model: string | null;
  car_type: string | null;
  year_estimate: string | null;
  confidence: string | null;
  image_url: string;
  identification_data: CarDetails;
  created_at: string | null;
}

export interface NearbyCarsResponse {
  results: NearbyCar[];
  count: number;
  page: number;
  per_page: number;
  total_count: number;
  total_pages: number;
  center: { latitude: number; longitude: number };
  radius_km: number;
}

export interface PopularCar {
  id: number;
  make: string | null;
  model: string | null;
  car_type: string | null;
  year_estimate: string | null;
  confidence: string | null;
  image_url: string;
  likes: number;
  identification_data: CarDetails;
}

export interface PopularCarsResponse {
  results: PopularCar[];
  count: number;
  page: number;
  per_page: number;
  total_count: number;
  total_pages: number;
}

export interface LikedCarIdsResponse {
  liked_car_ids: number[];
}

export interface UserLikedCarsResponse {
  results: Array<{
    id: number;
    make: string | null;
    model: string | null;
    car_type: string | null;
    year_estimate: string | null;
    confidence: string | null;
    image_url: string;
    identification_data: CarDetails;
  }>;
  total_count: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export class CarApiService {
  /**
   * Create FormData for file upload
   */
  private static createFormData(
    imageUri: string,
    requestedFields: string[],
    storeResults: boolean,
    latitude?: number,
    longitude?: number
  ): FormData {
    const formData = new FormData();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `car_image_${timestamp}.jpg`;
    
    // React Native FormData accepts { uri, type, name } objects directly
    const file = {
      uri: imageUri,
      type: 'image/jpeg',
      name: filename,
    } as any;

    formData.append('image', file);
    formData.append('requested_fields', requestedFields.join(','));
    formData.append('store_results', storeResults.toString());
    if (latitude !== undefined) formData.append('latitude', latitude.toString());
    if (longitude !== undefined) formData.append('longitude', longitude.toString());

    return formData;
  }

  /**
   * Identify car from image
   */
  static async identifyCar(
    imageUri: string,
    requestedFields: string[] = ['make', 'model', 'description', 'car_type'],
    storeResults: boolean = true,
    latitude?: number,
    longitude?: number
  ): Promise<CarIdentificationResponse> {
    const formData = this.createFormData(imageUri, requestedFields, storeResults, latitude, longitude);
    return await HttpClient.uploadFile<CarIdentificationResponse>('api/v1/cars/identify', formData);
  }

  /**
   * Get paginated list of car identifications
   */
  static async getIdentifications(
    page: number = 1,
    perPage: number = 50,
    filters: {
      isCar?: boolean;
      make?: string;
      carType?: string;
      confidence?: 'high' | 'medium' | 'low';
    } = {}
  ): Promise<CarIdentificationListResponse> {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
    });

    if (filters.isCar !== undefined) queryParams.append('is_car', filters.isCar.toString());
    if (filters.make) queryParams.append('make', filters.make);
    if (filters.carType) queryParams.append('car_type', filters.carType);
    if (filters.confidence) queryParams.append('confidence', filters.confidence);

    return await HttpClient.get<CarIdentificationListResponse>(`api/v1/cars/identifications?${queryParams.toString()}`);
  }

  /**
   * Get specific car identification by ID
   */
  static async getIdentificationById(id: number) {
    return await HttpClient.get(`api/v1/cars/identifications/${id}`);
  }

  /**
   * Search car identifications
   */
  static async searchCars(query: string, page: number = 1, perPage: number = 8): Promise<SearchResponse> {
    const queryParams = new URLSearchParams({ q: query.trim(), page: page.toString(), per_page: perPage.toString() });
    return await HttpClient.get<SearchResponse>(`api/v1/cars/search?${queryParams.toString()}`);
  }

  /**
   * Get available identification fields
   */
  static async getAvailableFields() {
    return await HttpClient.get('api/v1/cars/identification-fields');
  }

  /**
   * Get nearby car identifications within a radius
   */
  static async getNearbyCars(
    latitude: number,
    longitude: number,
    radiusKm: number = 50,
    page: number = 1,
    perPage: number = 20
  ): Promise<NearbyCarsResponse> {
    const queryParams = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      radius_km: radiusKm.toString(),
      page: page.toString(),
      per_page: perPage.toString(),
    });
    return await HttpClient.get<NearbyCarsResponse>(`api/v1/cars/nearby?${queryParams.toString()}`);
  }

  /**
   * Like a car
   */
  static async likeCar(carId: number): Promise<void> {
    await HttpClient.post(`api/v1/cars/${carId}/like`, {});
  }

  /**
   * Unlike a car
   */
  static async unlikeCar(carId: number): Promise<void> {
    await HttpClient.delete(`api/v1/cars/${carId}/like`);
  }

  /**
   * Get popular cars sorted by likes
   */
  static async getPopularCars(page: number = 1, perPage: number = 20): Promise<PopularCarsResponse> {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
    });
    return await HttpClient.get<PopularCarsResponse>(`api/v1/cars/popular?${queryParams.toString()}`);
  }

  /**
   * Get list of car IDs the current user has liked
   */
  static async getLikedCarIds(): Promise<LikedCarIdsResponse> {
    return await HttpClient.get<LikedCarIdsResponse>('api/v1/cars/liked');
  }

  /**
   * Get paginated car details for cars the current user has liked
   */
  static async getUserLikedCars(page: number = 1, perPage: number = 8): Promise<UserLikedCarsResponse> {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
    });
    return await HttpClient.get<UserLikedCarsResponse>(`api/v1/cars/user-liked?${queryParams.toString()}`);
  }

  /**
   * Update an identification with user-edited data
   */
  static async updateIdentification(
    id: number,
    updates: Partial<CarDetails>
  ): Promise<{ id: number; identification_data: CarDetails; user_modified: boolean }> {
    return await HttpClient.put(`api/v1/cars/identifications/${id}`, updates);
  }

  /**
   * Delete a car identification and its associated S3 image
   */
  static async deleteIdentification(id: number): Promise<void> {
    await HttpClient.delete(`api/v1/cars/identifications/${id}`);
  }
}

// Export types and service
export default CarApiService;