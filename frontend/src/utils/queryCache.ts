// Simple query cache for GET requests using AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CachePolicy = {
  ttl: number; // ms
};

const CACHE_PREFIX = '@CarId:queryCache:';

export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  policy: CachePolicy
): Promise<T> {
  const cacheKey = CACHE_PREFIX + key;
  const now = Date.now();
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const { value, expires } = JSON.parse(cached);
      if (expires > now) {
        return value;
      }
    }
  } catch {}
  // Not cached or expired
  const value = await fetcher();
  try {
    await AsyncStorage.setItem(
      cacheKey,
      JSON.stringify({ value, expires: now + policy.ttl })
    );
  } catch {}
  return value;
}

export async function invalidateCache(key: string) {
  await AsyncStorage.removeItem(CACHE_PREFIX + key);
}
