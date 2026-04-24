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
  const filename = simpleHash(uri);
  return `${RNFS.CachesDirectoryPath}/carid-cache-${filename}`;
}

export const CachedImage: React.FC<ImageProps> = ({ source, ...props }) => {
  const isRemoteUri =
    source &&
    typeof source === 'object' &&
    'uri' in source &&
    typeof source.uri === 'string' &&
    source.uri.startsWith('http');

  // Stable string URI — avoids effect re-running on every parent re-render
  // that creates a new source object with the same URI.
  const imgUri = isRemoteUri ? (source as { uri: string }).uri : undefined;

  // Initialize synchronously from memory cache so warm hits never cause a
  // state transition (and therefore never trigger a second image load).
  const [uri, setUri] = useState<string | undefined>(() =>
    imgUri ? memoryCache[imgUri] : undefined,
  );

  useEffect(() => {
    if (!imgUri) {
      setUri(undefined);
      return;
    }

    // Memory cache already set the initial state — nothing to do.
    if (memoryCache[imgUri]) {
      if (uri !== memoryCache[imgUri]) setUri(memoryCache[imgUri]);
      return;
    }

    let isMounted = true;
    const cacheKey = getCacheKey(imgUri);
    const localFilePath = getLocalFilePath(imgUri);
    // Capture as narrowed string so closures below see it as non-optional
    const uri_ = imgUri;

    async function load() {
      // Check disk cache
      const cacheEntryRaw = await AsyncStorage.getItem(cacheKey);
      let cacheEntry: { path: string; timestamp: number } | null = null;
      if (cacheEntryRaw) {
        try {
          cacheEntry = JSON.parse(cacheEntryRaw);
        } catch {
          cacheEntry = { path: cacheEntryRaw, timestamp: 0 };
        }
      }

      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      if (
        cacheEntry?.path &&
        cacheEntry.timestamp &&
        now - cacheEntry.timestamp < oneHour &&
        (await RNFS.exists(cacheEntry.path.replace('file://', '')))
      ) {
        const fileUri = cacheEntry.path.startsWith('file://')
          ? cacheEntry.path
          : 'file://' + cacheEntry.path;
        memoryCache[uri_] = fileUri;
        if (isMounted) setUri(fileUri);
        return;
      }

      // Cache miss — show the remote URL immediately (single render).
      // The Image component is already rendering with imgUri via the fallback
      // below, so this setUri call results in no URI change and no reload.
      if (isMounted) setUri(uri_);

      // Download to disk in the background. Do NOT call setUri after the
      // download — the image is already displaying correctly from the remote
      // URL. The cached local file will be used on the next mount.
      try {
        const result = await RNFS.downloadFile({
          fromUrl: uri_,
          toFile: localFilePath,
        }).promise;
        if (result.statusCode === 200) {
          const fileUri = 'file://' + localFilePath;
          memoryCache[uri_] = fileUri;
          await AsyncStorage.setItem(
            cacheKey,
            JSON.stringify({ path: fileUri, timestamp: Date.now() }),
          );
        } else {
          memoryCache[uri_] = uri_;
        }
      } catch (e) {
        memoryCache[uri_] = uri_;
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [imgUri]); // Depend on the URI string, not the source object reference

  if (!isRemoteUri) {
    return <Image {...props} source={source} />;
  }

  // `uri ?? imgUri` — while the async cache check is running, fall back to
  // the remote URL so the image starts loading immediately with no blank flash.
  return <Image {...props} source={{ uri: uri ?? imgUri }} />;
};

export default CachedImage;
