/**
 * Local Database for storing generated images
 * Uses IndexedDB for persistent client-side storage
 */

import type { GeneratedImage } from './types';

const DB_NAME = 'FuzzyPancakeDB';
const DB_VERSION = 1;
const STORE_NAME = 'generatedImages';

interface StoredImage extends Omit<GeneratedImage, 'timestamp'> {
  timestamp: string; // ISO string for serialization
}

/**
 * Initialize IndexedDB database
 */
export function initDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store for images
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Save a generated image to local storage
 */
export async function saveImageToLocal(image: GeneratedImage): Promise<void> {
  const db = await initDatabase();

  const storedImage: StoredImage = {
    ...image,
    timestamp: image.timestamp.toISOString(),
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(storedImage);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Load all saved images from local storage
 */
export async function loadImagesFromLocal(): Promise<GeneratedImage[]> {
  const db = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    const request = index.openCursor(null, 'prev'); // Most recent first

    const images: GeneratedImage[] = [];

    request.onerror = () => reject(request.error);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        const storedImage: StoredImage = cursor.value;
        const image: GeneratedImage = {
          ...storedImage,
          timestamp: new Date(storedImage.timestamp),
        };
        images.push(image);
        cursor.continue();
      } else {
        resolve(images);
      }
    };
  });
}

/**
 * Delete a specific image from local storage
 */
export async function deleteImageFromLocal(imageId: string): Promise<void> {
  const db = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(imageId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Clear all saved images from local storage
 */
export async function clearAllImagesFromLocal(): Promise<void> {
  const db = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Get storage usage information
 */
export async function getStorageInfo(): Promise<{ count: number; estimatedSize: string }> {
  try {
    const db = await initDatabase();

    const count = await new Promise<number>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    // Estimate storage usage
    const estimate = await navigator.storage?.estimate?.();
    const usedMB = estimate?.usage ? (estimate.usage / 1024 / 1024).toFixed(1) : 'Unknown';

    return {
      count,
      estimatedSize: `${usedMB}MB`,
    };
  } catch (error) {
    console.error('Error getting storage info:', error);
    return { count: 0, estimatedSize: 'Unknown' };
  }
}