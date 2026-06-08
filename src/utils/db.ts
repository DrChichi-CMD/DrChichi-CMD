/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Simple robust wrapper for IndexedDB to store and retrieve uploaded media files (Blobs/Files)
const DB_NAME = 'ChurchProjectorDB';
const DB_VERSION = 1;
const STORE_NAME = 'media_files';

function initDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveMediaBlob(id: string, blob: Blob): Promise<void> {
  try {
    const db = await initDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(blob, id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('IndexedDB saveMediaBlob error:', err);
    throw err;
  }
}

export async function getMediaBlob(id: string): Promise<Blob | null> {
  try {
    const db = await initDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('IndexedDB getMediaBlob error:', err);
    return null;
  }
}

export async function deleteMediaBlob(id: string): Promise<void> {
  try {
    const db = await initDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('IndexedDB deleteMediaBlob error:', err);
  }
}

import { useState, useEffect } from 'react';

export function useResolvedVideoUrl(url: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setResolved(null);
      return;
    }

    if (url.startsWith('db://')) {
      const id = url.substring(5); // remove 'db://'
      let active = true;
      let localUrl: string | null = null;

      getMediaBlob(id).then(blob => {
        if (!active) return;
        if (blob) {
          localUrl = URL.createObjectURL(blob);
          setResolved(localUrl);
        } else {
          setResolved(null);
        }
      }).catch(err => {
        console.error('useResolvedVideoUrl error:', err);
        if (active) setResolved(null);
      });

      return () => {
        active = false;
        if (localUrl) {
          URL.revokeObjectURL(localUrl);
        }
      };
    } else {
      setResolved(url);
    }
  }, [url]);

  return resolved;
}

