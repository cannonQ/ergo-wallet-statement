/**
 * IndexedDB Cache Service
 *
 * Provides persistent caching for historical price data.
 * This avoids re-fetching large JSON files on repeat visits.
 *
 * Historical price data is immutable - past months never change,
 * only new months are appended. We use version-based invalidation
 * rather than time-based expiration.
 */

const DB_NAME = 'ergo-wallet-cache';
const DB_VERSION = 2; // Bumped for new schema

interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt: number;
  /** Data version (e.g., "v5" from filename) for immutable data */
  version?: string;
  /** Last month in the dataset for append-only data */
  lastMonth?: string;
}

class IndexedDbCacheService {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Initialize the IndexedDB database
   */
  private async getDb(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create stores for different cache types
        if (!db.objectStoreNames.contains('prices')) {
          db.createObjectStore('prices', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('json')) {
          db.createObjectStore('json', { keyPath: 'key' });
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * Get cached data
   */
  async get<T>(storeName: string, key: string): Promise<T | null> {
    try {
      const db = await this.getDb();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const entry = request.result as CacheEntry<T> | undefined;

          if (!entry) {
            resolve(null);
            return;
          }

          // Check if expired
          if (entry.expiresAt < Date.now()) {
            // Clean up expired entry
            this.delete(storeName, key).catch(console.error);
            resolve(null);
            return;
          }

          resolve(entry.data);
        };
      });
    } catch (error) {
      console.error('IndexedDB get error:', error);
      return null;
    }
  }

  /**
   * Set cached data with TTL and optional version info
   * For immutable historical data, use a very long TTL with version tracking
   */
  async set<T>(
    storeName: string,
    key: string,
    data: T,
    options: {
      ttlMs?: number;
      version?: string;
      lastMonth?: string;
    } = {}
  ): Promise<void> {
    const { ttlMs = 24 * 60 * 60 * 1000, version, lastMonth } = options;

    try {
      const db = await this.getDb();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

        const entry: CacheEntry<T> = {
          key,
          data,
          timestamp: Date.now(),
          expiresAt: Date.now() + ttlMs,
          version,
          lastMonth,
        };

        const request = store.put(entry);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch (error) {
      console.error('IndexedDB set error:', error);
    }
  }

  /**
   * Get cache metadata without loading full data
   * Useful for checking if cache needs refresh for append-only data
   */
  async getMetadata(storeName: string, key: string): Promise<{
    exists: boolean;
    version?: string;
    lastMonth?: string;
    timestamp?: number;
  }> {
    try {
      const db = await this.getDb();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const entry = request.result as CacheEntry<unknown> | undefined;

          if (!entry) {
            resolve({ exists: false });
            return;
          }

          resolve({
            exists: true,
            version: entry.version,
            lastMonth: entry.lastMonth,
            timestamp: entry.timestamp,
          });
        };
      });
    } catch (error) {
      console.error('IndexedDB getMetadata error:', error);
      return { exists: false };
    }
  }

  /**
   * Delete cached data
   */
  async delete(storeName: string, key: string): Promise<void> {
    try {
      const db = await this.getDb();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch (error) {
      console.error('IndexedDB delete error:', error);
    }
  }

  /**
   * Clear all cached data in a store
   */
  async clear(storeName: string): Promise<void> {
    try {
      const db = await this.getDb();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch (error) {
      console.error('IndexedDB clear error:', error);
    }
  }

  /**
   * Check if IndexedDB is supported
   */
  isSupported(): boolean {
    return typeof indexedDB !== 'undefined';
  }
}

// Export singleton
export const indexedDbCache = new IndexedDbCacheService();
