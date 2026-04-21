import React, { useEffect, useState } from 'react';
import { Image, ImageProps } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

// Usage: <CachedImage source={{ uri: ... }} style={...} />
// Only supports remote uri (not require/local)
// This version caches images to disk using react-native-fs.

const CACHE_PREFIX = '@CarId:imageCache:';
const memoryCache: { [uri: string]: string } = {};


function getCacheKey(uri: string) {
  return CACHE_PREFIX + encodeURIComponent(uri);
}

function getLocalFilePath(uri: string) {
  // Use a hash or encoded URI for filename
  const filename = encodeURIComponent(uri);
  return `${RNFS.CachesDirectoryPath}/carid-cache-${filename}`;
}



export const CachedImage: React.FC<ImageProps> = ({ source, ...props }) => {
  const [uri, setUri] = useState<string | undefined>(
    source && typeof source === 'object' && 'uri' in source ? source.uri : undefined
  );

  useEffect(() => {
    let isMounted = true;
    if (!source || typeof source !== 'object' || !('uri' in source) || !source.uri) {
      setUri(undefined);
      return;
    }
    const imgUri = source.uri;
    const cacheKey = getCacheKey(imgUri);
    const localFilePath = getLocalFilePath(imgUri);

    async function load() {
      // Check in-memory cache first
      if (memoryCache[imgUri]) {
        setUri(memoryCache[imgUri]);
        return;
      }
      // Check AsyncStorage for local file path
      const cachedPath = await AsyncStorage.getItem(cacheKey);
      if (cachedPath && (await RNFS.exists(cachedPath))) {
        memoryCache[imgUri] = cachedPath;
        if (isMounted) setUri(cachedPath);
        return;
      }
      // Download image to local file system
      try {
        const downloadResult = await RNFS.downloadFile({
          fromUrl: imgUri,
          toFile: localFilePath,
        }).promise;
        if (downloadResult.statusCode === 200) {
          memoryCache[imgUri] = localFilePath;
          await AsyncStorage.setItem(cacheKey, localFilePath);
          if (isMounted) setUri(localFilePath);
        } else {
          // Fallback to remote URI
          memoryCache[imgUri] = imgUri;
          if (isMounted) setUri(imgUri);
        }
      } catch (e) {
        // Fallback to remote URI
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
    return <Image {...props} source={{ uri }} />;
  }
  return <Image {...props} source={source} />;
};

export default CachedImage;
