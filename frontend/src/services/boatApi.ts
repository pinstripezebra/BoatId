import { HttpClient } from './httpClient';

export interface BoatIdentificationRequest {
  image: File | Blob;
  requestedFields?: string[];
  storeResults?: boolean;
}

export interface BoatDetails {
  make?: string;
  model?: string;
  description?: string;
  year?: string;
  length?: string;
  boat_type?: string;
  hull_material?: string;
  features?: string[];
}

export interface BoatIdentificationResponse {
  success: boolean;
  identification_id?: number;
  filename: string;
  is_boat: boolean;
  boat_details?: BoatDetails;
  confidence?: string;
  message?: string;
}

export interface BoatIdentificationListResponse {
  results: Array<{
    id: number;
    image_url: string;
    filename: string;
    created_at: string;
    identification_data: BoatDetails & {
      is_boat: boolean;
      confidence: string;
    };
    is_boat: boolean;
  }>;
  total_count: number;
  page_size: number;
  offset: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface SearchResponse {
  query: string;
  results: Array<{
    id: number;
    image_url: string;
    identification_data: BoatDetails & {
      is_boat: boolean;
      confidence: string;
    };
    relevance_score: number;
  }>;
  count: number;
}

export interface NearbyBoat {
  id: number;
  latitude: number;
  longitude: number;
  make: string | null;
  model: string | null;
  boat_type: string | null;
  image_url: string;
  created_at: string | null;
}

export interface NearbyBoatsResponse {
  results: NearbyBoat[];
  count: number;
  center: { latitude: number; longitude: number };
  radius_km: number;
}

export interface PopularBoat {
  id: number;
  make: string | null;
  model: string | null;
  boat_type: string | null;
  year_estimate: string | null;
  confidence: string | null;
  image_url: string;
  likes: number;
  identification_data: BoatDetails;
}

export interface PopularBoatsResponse {
  results: PopularBoat[];
  count: number;
}

export interface LikedBoatIdsResponse {
  liked_boat_ids: number[];
}

export interface UserLikedBoatsResponse {
  results: Array<{
    id: number;
    make: string | null;
    model: string | null;
    boat_type: string | null;
    year_estimate: string | null;
    confidence: string | null;
    image_url: string;
    identification_data: BoatDetails;
  }>;
  total_count: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export class BoatApiService {
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
    const filename = `boat_image_${timestamp}.jpg`;
    
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
   * Identify boat from image
   */
  static async identifyBoat(
    imageUri: string,
    requestedFields: string[] = ['make', 'model', 'description', 'boat_type'],
    storeResults: boolean = true,
    latitude?: number,
    longitude?: number
  ): Promise<BoatIdentificationResponse> {
    const formData = this.createFormData(imageUri, requestedFields, storeResults, latitude, longitude);
    return await HttpClient.uploadFile<BoatIdentificationResponse>('api/v1/boats/identify', formData);
  }

  /**
   * Get paginated list of boat identifications
   */
  static async getIdentifications(
    page: number = 1,
    perPage: number = 50,
    filters: {
      isBoat?: boolean;
      make?: string;
      boatType?: string;
      confidence?: 'high' | 'medium' | 'low';
    } = {}
  ): Promise<BoatIdentificationListResponse> {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
    });

    if (filters.isBoat !== undefined) queryParams.append('is_boat', filters.isBoat.toString());
    if (filters.make) queryParams.append('make', filters.make);
    if (filters.boatType) queryParams.append('boat_type', filters.boatType);
    if (filters.confidence) queryParams.append('confidence', filters.confidence);

    return await HttpClient.get<BoatIdentificationListResponse>(`api/v1/boats/identifications?${queryParams.toString()}`);
  }

  /**
   * Get specific boat identification by ID
   */
  static async getIdentificationById(id: number) {
    return await HttpClient.get(`api/v1/boats/identifications/${id}`);
  }

  /**
   * Search boat identifications
   */
  static async searchBoats(query: string, limit: number = 50): Promise<SearchResponse> {
    const queryParams = new URLSearchParams({ q: query.trim(), limit: limit.toString() });
    return await HttpClient.get<SearchResponse>(`api/v1/boats/search?${queryParams.toString()}`);
  }

  /**
   * Get available identification fields
   */
  static async getAvailableFields() {
    return await HttpClient.get('api/v1/boats/identification-fields');
  }

  /**
   * Get nearby boat identifications within a radius
   */
  static async getNearbyBoats(
    latitude: number,
    longitude: number,
    radiusKm: number = 50
  ): Promise<NearbyBoatsResponse> {
    const queryParams = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      radius_km: radiusKm.toString(),
    });
    return await HttpClient.get<NearbyBoatsResponse>(`api/v1/boats/nearby?${queryParams.toString()}`);
  }

  /**
   * Like a boat
   */
  static async likeBoat(boatId: number): Promise<void> {
    await HttpClient.post(`api/v1/boats/${boatId}/like`, {});
  }

  /**
   * Unlike a boat
   */
  static async unlikeBoat(boatId: number): Promise<void> {
    await HttpClient.delete(`api/v1/boats/${boatId}/like`);
  }

  /**
   * Get popular boats sorted by likes
   */
  static async getPopularBoats(limit: number = 5): Promise<PopularBoatsResponse> {
    return await HttpClient.get<PopularBoatsResponse>(`api/v1/boats/popular?limit=${limit}`);
  }

  /**
   * Get list of boat IDs the current user has liked
   */
  static async getLikedBoatIds(): Promise<LikedBoatIdsResponse> {
    return await HttpClient.get<LikedBoatIdsResponse>('api/v1/boats/liked');
  }

  /**
   * Get paginated boat details for boats the current user has liked
   */
  static async getUserLikedBoats(page: number = 1, perPage: number = 8): Promise<UserLikedBoatsResponse> {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
    });
    return await HttpClient.get<UserLikedBoatsResponse>(`api/v1/boats/user-liked?${queryParams.toString()}`);
  }
}

// Export types and service
export default BoatApiService;