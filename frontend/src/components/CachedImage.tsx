import React, { useEffect, useState } from 'react';
import { Image, ImageProps } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

// Simple hash function for shorter filenames
function simpleHash(str: string) {
  let hash = 0, i, chr;
  if (str.length === 0) return hash.toString();
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString();
}
// Usage: <CachedImage source={{ uri: ... }} style={...} />
// Only supports remote uri (not require/local)
// This version caches images to disk using react-native-fs.

const CACHE_PREFIX = '@CarId:imageCache:';
const memoryCache: { [uri: string]: string } = {};


function getCacheKey(uri: string) {
  return CACHE_PREFIX + encodeURIComponent(uri);
}

function getLocalFilePath(uri: string) {
  // Use a short hash for filename to avoid long/invalid names
  const filename = simpleHash(uri);
  return `${RNFS.CachesDirectoryPath}/carid-cache-${filename}`;
}




export const CachedImage: React.FC<ImageProps> = ({ source, ...props }) => {
  // Only cache remote images with a valid uri
  const isRemoteUri = source && typeof source === 'object' && 'uri' in source && typeof source.uri === 'string' && source.uri.startsWith('http');
  const [uri, setUri] = useState<string | undefined>(isRemoteUri ? source.uri : undefined);

  useEffect(() => {
    let isMounted = true;
    if (!isRemoteUri) {
      setUri(undefined);
      return;
    }
    const imgUri = (source as { uri: string }).uri;
    const cacheKey = getCacheKey(imgUri);
    const localFilePath = getLocalFilePath(imgUri);

    async function load() {
      // Check in-memory cache first
      if (memoryCache[imgUri]) {
        console.log('[CachedImage] Using in-memory cache for', imgUri, '->', memoryCache[imgUri]);
        setUri(memoryCache[imgUri]);
        return;
      }
      // Check AsyncStorage for local file path and timestamp (TTL)
      const cacheEntryRaw = await AsyncStorage.getItem(cacheKey);
      let cacheEntry: { path: string, timestamp: number } | null = null;
      if (cacheEntryRaw) {
        try {
          cacheEntry = JSON.parse(cacheEntryRaw);
        } catch (e) {
          // fallback for old format (just path string)
          cacheEntry = { path: cacheEntryRaw, timestamp: 0 };
        }
      }
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      if (
        cacheEntry &&
        cacheEntry.path &&
        (await RNFS.exists(cacheEntry.path.replace('file://', '')))
        && (cacheEntry.timestamp && now - cacheEntry.timestamp < oneHour)
      ) {
        const fileUri = cacheEntry.path.startsWith('file://') ? cacheEntry.path : 'file://' + cacheEntry.path;
        console.log('[CachedImage] Using disk cache for', imgUri, '->', fileUri);
        memoryCache[imgUri] = fileUri;
        if (isMounted) setUri(fileUri);
        return;
      }
      // Download image to local file system
      try {
        const downloadResult = await RNFS.downloadFile({
          fromUrl: imgUri,
          toFile: localFilePath,
        }).promise;
        if (downloadResult.statusCode === 200) {
          const fileUri = 'file://' + localFilePath;
          console.log('[CachedImage] Downloaded and cached', imgUri, '->', fileUri);
          memoryCache[imgUri] = fileUri;
          // Store both path and timestamp for TTL
          await AsyncStorage.setItem(cacheKey, JSON.stringify({ path: fileUri, timestamp: Date.now() }));
          if (isMounted) setUri(fileUri);
        } else {
          console.log('[CachedImage] Download failed, using remote URI for', imgUri);
          memoryCache[imgUri] = imgUri;
          if (isMounted) setUri(imgUri);
        }
      } catch (e) {
        console.log('[CachedImage] Error downloading', imgUri, e);
        memoryCache[imgUri] = imgUri;
        if (isMounted) setUri(imgUri);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [source]);

  if (uri) {
    console.log('[CachedImage] Rendering image with URI:', uri);
    return <Image {...props} source={{ uri }} />;
  }
  // For non-remote or invalid images, fallback to default rendering
  return <Image {...props} source={source} />;
};

export default CachedImage;
